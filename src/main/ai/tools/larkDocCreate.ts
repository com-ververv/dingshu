import { tool } from 'ai';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { createApprovalId, waitForApproval } from '../approval';
import { previewJson, type ChatToolEventSink } from '../events';
import { getLarkCliBin, runLarkCli } from '../../lark/cli';

const TOOL_NAME = 'lark_doc_create';
const LARK_CREATE_TIMEOUT_MS = 60_000;

type LarkCreateOutput = {
  data?: {
    document?: {
      document_id?: string;
      revision_id?: number;
      title?: string;
      token?: string;
      url?: string;
    };
  };
  document?: {
    document_id?: string;
    revision_id?: number;
    title?: string;
    token?: string;
    url?: string;
  };
  [key: string]: unknown;
};

function buildMarkdownContent(title: string, content: string): string {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  return `<title>${trimmedTitle}</title>\n${trimmedContent}`;
}

function parseCreateOutput(stdout: string): LarkCreateOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed) as LarkCreateOutput;
}

export function createLarkDocCreateTool(requestId: string, emitToolEvent: ChatToolEventSink) {
  return tool({
    description:
      '创建飞书云文档。用户要求把内容创建为飞书文档、生成文档、保存到飞书云文档时必须调用此工具。该工具会在执行前请求用户二次确认。',
    inputSchema: z.object({
      title: z.string().min(1).max(120).describe('文档标题'),
      contentMarkdown: z.string().min(1).describe('要写入飞书文档的 Markdown 正文，不包含 title 标签'),
    }),
    execute: async ({ title, contentMarkdown }, options: ToolExecutionOptions) => {
      const startedAt = Date.now();
      const input = {
        title,
        contentPreview: contentMarkdown.slice(0, 1_000),
      };
      const approvalId = createApprovalId(TOOL_NAME, options.toolCallId);
      const inputPreview = previewJson(input);

      emitToolEvent({
        requestId,
        type: 'tool-call-confirmation-required',
        approvalId,
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        action: '创建飞书云文档',
        riskSummary: '这会使用你的飞书账号创建一篇新的云文档。',
        targetPreview: title,
        inputPreview,
      });

      const decision = await waitForApproval(
        {
          approvalId,
          inputPreview,
          riskSummary: '这会使用你的飞书账号创建一篇新的云文档。',
          targetPreview: title,
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
        },
        options.abortSignal
      );

      if (!decision.approved) {
        const output = {
          ok: false,
          denied: true,
          reason: decision.reason ?? '用户拒绝执行',
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

      emitToolEvent({
        requestId,
        type: 'tool-call-start',
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        inputPreview,
      });

      const args = [
        'docs',
        '+create',
        '--api-version',
        'v2',
        '--as',
        'user',
        '--doc-format',
        'markdown',
        '--content',
        buildMarkdownContent(title, contentMarkdown),
      ];

      try {
        const result = await runLarkCli(args, {
          timeoutMs: LARK_CREATE_TIMEOUT_MS,
          abortSignal: options.abortSignal,
        });

        if (result.exitCode === null) {
          const output = {
            ok: false,
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

        const parsed = parseCreateOutput(result.stdout);
        const document = parsed.data?.document ?? parsed.document;
        const output = {
          ok: true,
          executable: getLarkCliBin(),
          title,
          document,
          raw: parsed,
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'completed',
          outputPreview: previewJson({
            title: output.title,
            url: output.document?.url,
            token: output.document?.token,
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
