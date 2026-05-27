import { runLarkCli } from './cli';

const LARK_CHAT_SEARCH_TIMEOUT_MS = 30_000;

type LarkChatSearchOutput = {
  data?: {
    chats?: {
      chat_id?: string;
      name?: string;
    }[];
  };
};

export async function resolveLarkChatByName(chatName: string, abortSignal?: AbortSignal) {
  const result = await runLarkCli(
    ['im', '+chat-search', '--as', 'user', '--query', chatName, '--page-size', '3', '--format', 'json'],
    {
      timeoutMs: LARK_CHAT_SEARCH_TIMEOUT_MS,
      abortSignal,
    }
  );

  if (result.exitCode !== 0) {
    return {
      ok: false as const,
      error: result.stderr || result.stdout || 'lark-cli chat search failed without output',
    };
  }

  const parsed = JSON.parse(result.stdout.trim()) as LarkChatSearchOutput;
  const firstChat = parsed.data?.chats?.[0];
  if (!firstChat?.chat_id) {
    return {
      ok: false as const,
      error: `未找到群聊：${chatName}`,
    };
  }

  return {
    ok: true as const,
    chatId: firstChat.chat_id,
    chatName: firstChat.name ?? chatName,
  };
}
