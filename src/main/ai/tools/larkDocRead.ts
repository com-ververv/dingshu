import { tool } from 'ai';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { previewJson, type ChatToolEventSink } from '../events';
import { getLarkCliBin, runLarkCli } from '../../lark/cli';

const TOOL_NAME = 'lark_doc_read';
const LARK_READ_TIMEOUT_MS = 60_000;
const MAX_CONTENT_LENGTH = 12_000;

type LarkFetchOutput = {
  data?: {
    document?: {
      content?: string;
      document_id?: string;
      revision_id?: number;
      title?: string;
    };
  };
  document?: {
    content?: string;
    document_id?: string;
    revision_id?: number;
    title?: string;
  };
};

function extractDocumentToken(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/\/(?:docx|docs|wiki)\/([A-Za-z0-9]+)/);
  return match?.[1] ?? trimmed;
}

function cleanDocumentContent(content: string): string {
  return content.replace(/<title>(.*?)<\/title>/g, '# $1').trim();
}

function truncateContent(content: string): { content: string; truncated: boolean } {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return { content, truncated: false };
  }
  return {
    content: `${content.slice(0, MAX_CONTENT_LENGTH)}\n\n...<truncated>`,
    truncated: true,
  };
}

function parseFetchOutput(stdout: string) {
  const parsed = JSON.parse(stdout) as LarkFetchOutput;
  const document = parsed.data?.document ?? parsed.document;
  const rawContent = document?.content ?? '';
  const cleaned = truncateContent(cleanDocumentContent(rawContent));

  return {
    documentId: document?.document_id,
    revisionId: document?.revision_id,
    title: document?.title,
    contentMarkdown: cleaned.content,
    truncated: cleaned.truncated,
  };
}

export function createLarkDocReadTool(requestId: string, emitToolEvent: ChatToolEventSink) {
  return tool({
    description:
      '读取当前用户有权限访问的飞书云文档内容。用户要求读取、打开、总结某个飞书文档链接或文档 token 时必须调用此工具。',
    inputSchema: z.object({
      doc: z.string().min(1).describe('飞书文档 URL 或 token，例如 https://.../docx/xxx 或 xxx'),
    }),
    execute: async ({ doc }, options: ToolExecutionOptions) => {
      const startedAt = Date.now();
      const normalizedDoc = extractDocumentToken(doc);
      const inputPreview = previewJson({ doc: normalizedDoc });

      emitToolEvent({
        requestId,
        type: 'tool-call-start',
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        inputPreview,
      });

      const args = [
        'docs',
        '+fetch',
        '--api-version',
        'v2',
        '--as',
        'user',
        '--doc',
        normalizedDoc,
        '--doc-format',
        'markdown',
        '--format',
        'json',
        '--detail',
        'simple',
      ];

      try {
        const result = await runLarkCli(args, {
          timeoutMs: LARK_READ_TIMEOUT_MS,
          abortSignal: options.abortSignal,
        });

        if (result.exitCode === null) {
          const output = {
            ok: false,
            doc: normalizedDoc,
            cancelled: true,
          };
          emitToolEvent({
            requestId,
            type: 'tool-call-result',
            toolCallId: options.toolCallId,
            toolName: TOOL_NAME,
            status: 'cancelled',
            outputPreview: previewJson(output),
            elapsedMs: Date.now() - startedAt,
          });
          return output;
        }

        if (result.exitCode !== 0) {
          const output = {
            ok: false,
            doc: normalizedDoc,
            executable: getLarkCliBin(),
            exitCode: result.exitCode,
            error: previewJson(result.stderr || result.stdout || 'lark-cli failed without output'),
          };
          emitToolEvent({
            requestId,
            type: 'tool-call-result',
            toolCallId: options.toolCallId,
            toolName: TOOL_NAME,
            status: 'failed',
            outputPreview: previewJson(output),
            errorMessage: output.error,
            elapsedMs: Date.now() - startedAt,
          });
          return output;
        }

        const output = {
          ok: true,
          doc: normalizedDoc,
          executable: getLarkCliBin(),
          ...parseFetchOutput(result.stdout),
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'completed',
          outputPreview: previewJson({
            doc: output.doc,
            documentId: output.documentId,
            revisionId: output.revisionId,
            contentPreview: output.contentMarkdown.slice(0, 1_000),
            truncated: output.truncated,
          }),
          elapsedMs: Date.now() - startedAt,
        });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'failed',
          errorMessage: message,
          elapsedMs: Date.now() - startedAt,
        });
        throw error;
      }
    },
  });
}
