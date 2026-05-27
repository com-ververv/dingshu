import { BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { resolveApproval } from '../main/ai/approval';
import { streamChat, type ChatMessage } from '../main/ai/chatService';
import type { ChatToolEvent } from '../main/ai/events';
import {
  ensureConversation,
  getConversation,
  insertChatMessage,
  listConversations,
  softDeleteConversation,
  updateChatMessage,
  upsertToolEvent,
} from '../database/chatRepository';

type ChatSendRequest = {
  assistantMessageId?: string;
  conversationId?: string;
  requestId: string;
  messages: ChatMessage[];
  userMessage?: {
    id: string;
    content: string;
  };
};

type ChatStreamEvent =
  | { conversationId?: string; requestId: string; type: 'delta'; textDelta: string }
  | { conversationId?: string; requestId: string; type: 'done'; finishReason?: string; usage?: unknown }
  | {
      conversationId?: string;
      requestId: string;
      type: 'error';
      error: { code: string; message: string; recoverable: boolean };
    }
  | (ChatToolEvent & { conversationId?: string });

const activeControllers = new Map<string, AbortController>();

function sendChatEvent(window: BrowserWindow | null, event: ChatStreamEvent): void {
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send(`chat:${event.type}`, event);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getRecoverableError(error: unknown): { code: string; message: string; recoverable: boolean } {
  const message = toErrorMessage(error);
  if (message.toLowerCase().includes('abort')) {
    return { code: 'chat.aborted', message: '生成已停止', recoverable: true };
  }
  if (message.toLowerCase().includes('api key') || message.includes('401') || message.includes('403')) {
    return { code: 'chat.auth', message, recoverable: false };
  }
  return { code: 'chat.request_failed', message, recoverable: true };
}

async function handleChatSend(event: IpcMainInvokeEvent, request: ChatSendRequest) {
  console.log(`[Chat] send request=${request.requestId} messages=${request.messages.length}`);

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'MISSING_SILICONFLOW_API_KEY',
        message: '缺少 SILICONFLOW_API_KEY。请在项目根目录 .env 中配置后重启应用。',
      },
    };
  }

  if (activeControllers.has(request.requestId)) {
    return {
      success: false,
      error: {
        code: 'CHAT_REQUEST_EXISTS',
        message: '同一个请求正在生成中。',
      },
    };
  }

  const window = BrowserWindow.fromWebContents(event.sender);
  const controller = new AbortController();
  activeControllers.set(request.requestId, controller);
  const lastUserContent = request.userMessage?.content ?? [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const conversation = ensureConversation(request.conversationId, lastUserContent);
  const assistantMessageId = request.assistantMessageId ?? `${request.requestId}_assistant`;

  if (request.userMessage) {
    insertChatMessage({
      id: request.userMessage.id,
      conversationId: conversation.id,
      role: 'user',
      content: request.userMessage.content,
      status: 'completed',
    });
  }

  insertChatMessage({
    id: assistantMessageId,
    conversationId: conversation.id,
    role: 'assistant',
    content: '',
    status: 'streaming',
  });

  void (async () => {
    let assistantContent = '';
    try {
      const result = streamChat({
        apiKey,
        abortSignal: controller.signal,
        messages: request.messages,
        requestId: request.requestId,
        emitToolEvent: (toolEvent) => {
          upsertToolEvent(conversation.id, assistantMessageId, toolEvent);
          sendChatEvent(window, { ...toolEvent, conversationId: conversation.id });
        },
      });

      let deltaCount = 0;
      for await (const textDelta of result.textStream) {
        deltaCount += 1;
        assistantContent += textDelta;
        sendChatEvent(window, {
          conversationId: conversation.id,
          requestId: request.requestId,
          type: 'delta',
          textDelta,
        });
      }

      const [finishReason, usage] = await Promise.all([result.finishReason, result.usage]);
      updateChatMessage({
        id: assistantMessageId,
        conversationId: conversation.id,
        content: assistantContent,
        status: 'completed',
      });
      console.log(`[Chat] done request=${request.requestId} deltas=${deltaCount} finishReason=${finishReason}`);
      sendChatEvent(window, {
        conversationId: conversation.id,
        requestId: request.requestId,
        type: 'done',
        finishReason,
        usage,
      });
    } catch (error) {
      console.error(`[Chat] error request=${request.requestId}`, error);
      const recoverableError = getRecoverableError(error);
      updateChatMessage({
        id: assistantMessageId,
        conversationId: conversation.id,
        content: assistantContent,
        status: recoverableError.code === 'chat.aborted' ? 'cancelled' : 'failed',
        error: recoverableError.message,
      });
      sendChatEvent(window, {
        conversationId: conversation.id,
        requestId: request.requestId,
        type: 'error',
        error: recoverableError,
      });
    } finally {
      activeControllers.delete(request.requestId);
    }
  })();

  return { success: true, data: { conversationId: conversation.id, assistantMessageId } };
}

function handleChatStop(_: IpcMainInvokeEvent, requestId: string) {
  const controller = activeControllers.get(requestId);
  if (!controller) {
    return {
      success: false,
      error: {
        code: 'CHAT_REQUEST_NOT_FOUND',
        message: '没有找到正在生成的请求。',
      },
    };
  }

  controller.abort();
  activeControllers.delete(requestId);
  return { success: true };
}

function handleApproveToolCall(_: IpcMainInvokeEvent, approvalId: string) {
  const success = resolveApproval(approvalId, { approved: true });
  if (!success) {
    return {
      success: false,
      error: {
        code: 'APPROVAL_NOT_FOUND',
        message: '没有找到待确认的工具调用。',
      },
    };
  }
  return { success: true };
}

function handleRejectToolCall(_: IpcMainInvokeEvent, approvalId: string, reason?: string) {
  const success = resolveApproval(approvalId, { approved: false, reason: reason ?? '用户拒绝执行' });
  if (!success) {
    return {
      success: false,
      error: {
        code: 'APPROVAL_NOT_FOUND',
        message: '没有找到待确认的工具调用。',
      },
    };
  }
  return { success: true };
}

export function registerChatIPCHandlers(): void {
  ipcMain.handle('chat:listConversations', () => {
    try {
      return { success: true, data: listConversations() };
    } catch (error) {
      return { success: false, error: { code: 'LIST_CONVERSATIONS_ERROR', message: String(error) } };
    }
  });
  ipcMain.handle('chat:getConversation', (_, conversationId: string) => {
    try {
      const conversation = getConversation(conversationId);
      if (!conversation) {
        return { success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: '没有找到会话。' } };
      }
      return { success: true, data: conversation };
    } catch (error) {
      return { success: false, error: { code: 'GET_CONVERSATION_ERROR', message: String(error) } };
    }
  });
  ipcMain.handle('chat:deleteConversation', (_, conversationId: string) => {
    try {
      const deleted = softDeleteConversation(conversationId);
      if (!deleted) {
        return { success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: '没有找到会话。' } };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_CONVERSATION_ERROR', message: String(error) } };
    }
  });
  ipcMain.handle('chat:send', handleChatSend);
  ipcMain.handle('chat:stop', handleChatStop);
  ipcMain.handle('chat:approveToolCall', handleApproveToolCall);
  ipcMain.handle('chat:rejectToolCall', handleRejectToolCall);
}
