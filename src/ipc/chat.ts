import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { stepCountIs, streamText, tool } from 'ai';
import { BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import { z } from 'zod';

const SILICONFLOW_MODEL_ID = 'Pro/moonshotai/Kimi-K2.6';
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';
const LARK_CLI_BIN = process.env.LARK_CLI_BIN ?? 'lark-cli';
const LARK_SEARCH_PAGE_SIZE = 5;
const LARK_SEARCH_TIMEOUT_MS = 30_000;

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

function stripHighlightTags(value: string | undefined): string {
  return (value ?? '').replace(/<\/?h[b]?>|<\/?b>/g, '');
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...<truncated>` : value;
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

function runLarkCli(args: string[], timeoutMs: number): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(LARK_CLI_BIN, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`lark-cli timed out after ${timeoutMs}ms: ${LARK_CLI_BIN} ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

const larkDocSearchTool = tool({
  description:
    '搜索当前用户有权限访问的飞书云文档。用户要求查看、查找、搜索飞书文档、知识库、测试文档、PRD 或项目资料时必须调用此工具。',
  inputSchema: z.object({
    query: z.string().min(1).describe('飞书文档搜索关键词，例如：测试、PRD、Pexar v2.2.4'),
  }),
  execute: async ({ query }) => {
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

    console.log(`[Chat] lark_doc_search query=${JSON.stringify(query)}`);
    const result = await runLarkCli(args, LARK_SEARCH_TIMEOUT_MS);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        query,
        executable: LARK_CLI_BIN,
        exitCode: result.exitCode,
        error: truncate(result.stderr || result.stdout || 'lark-cli failed without output', 2_000),
      };
    }

    return {
      query,
      executable: LARK_CLI_BIN,
      ...parseLarkSearchOutput(result.stdout),
    };
  },
});

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
      const siliconflow = createOpenAICompatible({
        name: 'siliconflow',
        apiKey,
        baseURL: SILICONFLOW_BASE_URL,
      });

      const result = streamText({
        model: siliconflow.chatModel(SILICONFLOW_MODEL_ID),
        system:
          '你是 Pexar Lark Agent 的桌面聊天助手。默认用中文回答，回答要简洁、具体、可执行。用户要求查看、查找、搜索飞书文档或测试相关资料时，必须先调用 lark_doc_search 工具，再基于工具结果回答；不要声称自己无法访问飞书，除非工具返回失败。',
        messages: request.messages,
        temperature: 0.4,
        maxOutputTokens: 2048,
        stopWhen: stepCountIs(4),
        tools: {
          lark_doc_search: larkDocSearchTool,
        },
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
