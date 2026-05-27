import { BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { resolveApproval } from '../main/ai/approval';
import { streamChat, type ChatMessage } from '../main/ai/chatService';
import type { ChatToolEvent } from '../main/ai/events';

type ChatSendRequest = {
  requestId: string;
  messages: ChatMessage[];
};

type ChatStreamEvent =
  | { requestId: string; type: 'delta'; textDelta: string }
  | { requestId: string; type: 'done'; finishReason?: string; usage?: unknown }
  | { requestId: string; type: 'error'; error: { code: string; message: string; recoverable: boolean } }
  | ChatToolEvent;

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

  void (async () => {
    try {
      const result = streamChat({
        apiKey,
        abortSignal: controller.signal,
        messages: request.messages,
        requestId: request.requestId,
        emitToolEvent: (toolEvent) => sendChatEvent(window, toolEvent),
      });

      let deltaCount = 0;
      for await (const textDelta of result.textStream) {
        deltaCount += 1;
        sendChatEvent(window, {
          requestId: request.requestId,
          type: 'delta',
          textDelta,
        });
      }

      const [finishReason, usage] = await Promise.all([result.finishReason, result.usage]);
      console.log(`[Chat] done request=${request.requestId} deltas=${deltaCount} finishReason=${finishReason}`);
      sendChatEvent(window, {
        requestId: request.requestId,
        type: 'done',
        finishReason,
        usage,
      });
    } catch (error) {
      console.error(`[Chat] error request=${request.requestId}`, error);
      sendChatEvent(window, {
        requestId: request.requestId,
        type: 'error',
        error: getRecoverableError(error),
      });
    } finally {
      activeControllers.delete(request.requestId);
    }
  })();

  return { success: true };
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
  ipcMain.handle('chat:send', handleChatSend);
  ipcMain.handle('chat:stop', handleChatStop);
  ipcMain.handle('chat:approveToolCall', handleApproveToolCall);
  ipcMain.handle('chat:rejectToolCall', handleRejectToolCall);
}
