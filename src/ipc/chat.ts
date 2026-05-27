import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

const SILICONFLOW_MODEL_ID = 'Pro/moonshotai/Kimi-K2.6';
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatSendRequest = {
  requestId: string;
  messages: ChatMessage[];
};

type ChatStreamEvent =
  | { requestId: string; type: 'delta'; textDelta: string }
  | { requestId: string; type: 'done'; finishReason?: string; usage?: unknown }
  | { requestId: string; type: 'error'; error: { code: string; message: string; recoverable: boolean } };

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
        message: '缺少 SILICONFLOW_API_KEY。请用环境变量启动应用后重试。',
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
      const siliconflow = createOpenAICompatible({
        name: 'siliconflow',
        apiKey,
        baseURL: SILICONFLOW_BASE_URL,
      });

      const result = streamText({
        model: siliconflow.chatModel(SILICONFLOW_MODEL_ID),
        system:
          '你是 Pexar Lark Agent 的桌面聊天助手。默认用中文回答，回答要简洁、具体、可执行。',
        messages: request.messages,
        temperature: 0.4,
        maxOutputTokens: 2048,
        abortSignal: controller.signal,
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

export function registerChatIPCHandlers(): void {
  ipcMain.handle('chat:send', handleChatSend);
  ipcMain.handle('chat:stop', handleChatStop);
}
