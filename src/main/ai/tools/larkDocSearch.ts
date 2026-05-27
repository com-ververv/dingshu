import { tool } from 'ai';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { previewJson, type ChatToolEventSink } from '../events';
import { getLarkCliBin, runLarkCli } from '../../lark/cli';

const LARK_SEARCH_PAGE_SIZE = 5;
const LARK_SEARCH_TIMEOUT_MS = 30_000;
const TOOL_NAME = 'lark_doc_search';

type LarkSearchResult = {
  entity_type?: string;
  result_meta?: {
    doc_types?: string;
    owner_name?: string;
    update_time_iso?: string;
    url?: string;
  };
  summary_highlighted?: string;
  title_highlighted?: string;
};

function stripHighlightTags(value: string | undefined): string {
  return (value ?? '').replace(/<\/?h[b]?>|<\/?b>/g, '');
}

function parseLarkSearchOutput(stdout: string) {
  const parsed = JSON.parse(stdout) as {
    ok?: boolean;
    data?: {
      total?: number;
      has_more?: boolean;
      results?: LarkSearchResult[];
    };
    meta?: {
      count?: number;
    };
  };

  return {
    ok: parsed.ok === true,
    total: parsed.data?.total ?? 0,
    count: parsed.meta?.count ?? parsed.data?.results?.length ?? 0,
    hasMore: parsed.data?.has_more ?? false,
    results: (parsed.data?.results ?? []).map((item) => ({
      title: stripHighlightTags(item.title_highlighted),
      summary: stripHighlightTags(item.summary_highlighted),
      type: item.result_meta?.doc_types ?? item.entity_type ?? 'UNKNOWN',
      owner: item.result_meta?.owner_name,
      updatedAt: item.result_meta?.update_time_iso,
      url: item.result_meta?.url,
    })),
  };
}

export function createLarkDocSearchTool(requestId: string, emitToolEvent: ChatToolEventSink) {
  return tool({
    description:
      '搜索当前用户有权限访问的飞书云文档。用户要求查看、查找、搜索飞书文档、知识库、测试文档、PRD 或项目资料时必须调用此工具。',
    inputSchema: z.object({
      query: z.string().min(1).describe('飞书文档搜索关键词，例如：测试、PRD、Pexar v2.2.4'),
    }),
    execute: async ({ query }, options: ToolExecutionOptions) => {
      const startedAt = Date.now();
      emitToolEvent({
        requestId,
        type: 'tool-call-start',
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        inputPreview: previewJson({ query }),
      });

      const args = [
        'docs',
        '+search',
        '--as',
        'user',
        '--query',
        query,
        '--page-size',
        String(LARK_SEARCH_PAGE_SIZE),
        '--format',
        'json',
      ];

      try {
        console.log(`[Chat] ${TOOL_NAME} query=${JSON.stringify(query)}`);
        const result = await runLarkCli(args, {
          timeoutMs: LARK_SEARCH_TIMEOUT_MS,
          abortSignal: options.abortSignal,
        });

        if (result.exitCode === null) {
          const output = {
            ok: false,
            query,
            executable: getLarkCliBin(),
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
            query,
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
          query,
          executable: getLarkCliBin(),
          ...parseLarkSearchOutput(result.stdout),
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'completed',
          outputPreview: previewJson({
            query: output.query,
            total: output.total,
            count: output.count,
            results: output.results.slice(0, 3),
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
