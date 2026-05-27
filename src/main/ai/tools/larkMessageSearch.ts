import { tool } from 'ai';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { previewJson, type ChatToolEventSink } from '../events';
import { getLarkCliBin, runLarkCli } from '../../lark/cli';
import { resolveLarkChatByName } from '../../lark/chat';

const TOOL_NAME = 'lark_message_search';
const LARK_MESSAGE_SEARCH_TIMEOUT_MS = 45_000;
const MAX_MESSAGE_RESULTS = 20;
const MAX_CONTENT_LENGTH = 1_500;

type LarkMessageSearchOutput = {
  data?: {
    messages?: {
      chat_id?: string;
      chat_name?: string;
      chat_type?: string;
      content?: string;
      create_time?: string;
      message_app_link?: string;
      message_id?: string;
      sender?: {
        name?: string;
        sender_type?: string;
      };
    }[];
    has_more?: boolean;
  };
};

function parseJson<T>(stdout: string): T {
  return JSON.parse(stdout.trim()) as T;
}

function normalizeContent(content: string | undefined): string {
  return (content ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_LENGTH);
}

function clampPageSize(pageSize?: number): number {
  if (!pageSize) {
    return 10;
  }
  return Math.min(Math.max(pageSize, 1), MAX_MESSAGE_RESULTS);
}

export function createLarkMessageSearchTool(requestId: string, emitToolEvent: ChatToolEventSink) {
  return tool({
    description:
      '搜索当前用户可见的飞书消息。用户要求查询、搜索、总结群消息或聊天记录时必须调用此工具。支持关键词、群名、开始时间、结束时间。',
    inputSchema: z.object({
      chatName: z.string().optional().describe('群聊名称关键词，例如 研发群；如果用户指定群名则填写'),
      end: z.string().optional().describe('结束时间，ISO 8601，例如 2026-05-27T23:59:59+08:00'),
      pageSize: z.number().int().min(1).max(MAX_MESSAGE_RESULTS).optional().describe('返回消息条数，默认 10，最大 20'),
      query: z.string().optional().describe('消息关键词；如果用户只要求总结某群今天消息，可省略'),
      start: z.string().optional().describe('开始时间，ISO 8601，例如 2026-05-27T00:00:00+08:00'),
    }),
    execute: async ({ chatName, end, pageSize, query, start }, options: ToolExecutionOptions) => {
      const startedAt = Date.now();
      const input = { chatName, end, pageSize: clampPageSize(pageSize), query, start };
      const inputPreview = previewJson(input);

      emitToolEvent({
        requestId,
        type: 'tool-call-start',
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        inputPreview,
      });

      try {
        let resolvedChat: { chatId?: string; chatName?: string } = {};
        if (chatName?.trim()) {
          const chatResult = await resolveLarkChatByName(chatName.trim(), options.abortSignal);
          if (!chatResult.ok) {
            const output = {
              ok: false,
              error: chatResult.error,
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
          resolvedChat = {
            chatId: chatResult.chatId,
            chatName: chatResult.chatName,
          };
        }

        const args = [
          'im',
          '+messages-search',
          '--as',
          'user',
          '--page-size',
          String(clampPageSize(pageSize)),
          '--format',
          'json',
        ];
        if (query?.trim()) {
          args.push('--query', query.trim());
        }
        if (resolvedChat.chatId) {
          args.push('--chat-id', resolvedChat.chatId);
        }
        if (start?.trim()) {
          args.push('--start', start.trim());
        }
        if (end?.trim()) {
          args.push('--end', end.trim());
        }

        const result = await runLarkCli(args, {
          timeoutMs: LARK_MESSAGE_SEARCH_TIMEOUT_MS,
          abortSignal: options.abortSignal,
        });

        if (result.exitCode === null) {
          const output = { ok: false, cancelled: true };
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

        const parsed = parseJson<LarkMessageSearchOutput>(result.stdout);
        const messages = (parsed.data?.messages ?? []).slice(0, MAX_MESSAGE_RESULTS).map((message) => ({
          chatId: message.chat_id,
          chatName: message.chat_name ?? resolvedChat.chatName,
          chatType: message.chat_type,
          content: normalizeContent(message.content),
          createdAt: message.create_time,
          link: message.message_app_link,
          messageId: message.message_id,
          senderName: message.sender?.name,
          senderType: message.sender?.sender_type,
        }));
        const output = {
          ok: true,
          executable: getLarkCliBin(),
          filter: input,
          resolvedChat,
          hasMore: parsed.data?.has_more ?? false,
          count: messages.length,
          messages,
        };

        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'completed',
          outputPreview: previewJson({
            count: output.count,
            hasMore: output.hasMore,
            resolvedChat: output.resolvedChat,
            messages: output.messages.slice(0, 3),
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
