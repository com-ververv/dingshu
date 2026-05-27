import { tool } from 'ai';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { createApprovalId, waitForApproval } from '../approval';
import { previewJson, type ChatToolEventSink } from '../events';
import { getLarkCliBin, runLarkCli } from '../../lark/cli';
import { resolveLarkChatByName } from '../../lark/chat';

const TOOL_NAME = 'lark_message_send';
const LARK_MESSAGE_SEND_TIMEOUT_MS = 45_000;

type LarkMessageSendOutput = {
  data?: {
    message?: {
      chat_id?: string;
      message_id?: string;
      root_id?: string;
    };
  };
  message?: {
    chat_id?: string;
    message_id?: string;
    root_id?: string;
  };
};

function parseSendOutput(stdout: string): LarkMessageSendOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed) as LarkMessageSendOutput;
}

export function createLarkMessageSendTool(requestId: string, emitToolEvent: ChatToolEventSink) {
  return tool({
    description:
      '发送飞书消息到群聊。用户要求发送、通知、转发消息到某个飞书群时必须调用此工具。该工具会在执行前请求用户二次确认。',
    inputSchema: z.object({
      chatId: z.string().optional().describe('目标群 chat_id，例如 oc_xxx；如果已知可直接填写'),
      chatName: z.string().optional().describe('目标群名称关键词；不知道 chat_id 时填写'),
      identity: z.enum(['bot', 'user']).optional().describe('发送身份，默认 bot。MVP 推荐 bot；user 需要额外 user send scope'),
      messageType: z.enum(['text', 'markdown']).optional().describe('消息类型，默认 text'),
      text: z.string().min(1).max(10_000).describe('要发送的消息正文'),
    }),
    execute: async ({ chatId, chatName, identity, messageType, text }, options: ToolExecutionOptions) => {
      const startedAt = Date.now();
      const target = chatId ?? chatName;
      if (!target) {
        const output = {
          ok: false,
          error: '缺少目标群聊。请提供 chatId 或 chatName。',
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

      let resolvedTarget = {
        chatId,
        chatName,
      };

      if (!resolvedTarget.chatId && chatName?.trim()) {
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
        resolvedTarget = {
          chatId: chatResult.chatId,
          chatName: chatResult.chatName,
        };
      }

      const input = {
        chatId: resolvedTarget.chatId,
        chatName: resolvedTarget.chatName,
        identity: identity ?? 'bot',
        messageType: messageType ?? 'text',
        textPreview: text.slice(0, 1_000),
      };
      const inputPreview = previewJson(input);
      const approvalId = createApprovalId(TOOL_NAME, options.toolCallId);

      emitToolEvent({
        requestId,
        type: 'tool-call-confirmation-required',
        approvalId,
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        action: '发送飞书消息',
        riskSummary: `这会使用 ${identity ?? 'bot'} 身份向目标会话发送消息。`,
        targetPreview: resolvedTarget.chatName ?? resolvedTarget.chatId,
        inputPreview,
      });

      const decision = await waitForApproval(
        {
          approvalId,
          inputPreview,
          riskSummary: `这会使用 ${identity ?? 'bot'} 身份向目标会话发送消息。`,
          targetPreview: resolvedTarget.chatName ?? resolvedTarget.chatId,
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
        'im',
        '+messages-send',
        '--as',
        identity ?? 'bot',
        '--chat-id',
        resolvedTarget.chatId ?? '',
        '--idempotency-key',
        options.toolCallId,
      ];
      if (messageType === 'markdown') {
        args.push('--markdown', text);
      } else {
        args.push('--text', text);
      }

      try {
        const result = await runLarkCli(args, {
          timeoutMs: LARK_MESSAGE_SEND_TIMEOUT_MS,
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

        const parsed = parseSendOutput(result.stdout);
        const message = parsed.data?.message ?? parsed.message;
        const output = {
          ok: true,
          executable: getLarkCliBin(),
          target: resolvedTarget,
          message,
          raw: parsed,
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'completed',
          outputPreview: previewJson({
            target: output.target,
            messageId: output.message?.message_id,
            chatId: output.message?.chat_id,
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
