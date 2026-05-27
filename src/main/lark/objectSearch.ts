import { classifyLarkCliError, runLarkCli } from './cli';

export type LarkObjectType = 'chat' | 'contact' | 'document';

export type LarkObjectSearchRequest = {
  limit?: number;
  query: string;
  types?: LarkObjectType[];
};

export type LarkObjectSearchResult = {
  id: string;
  reference: string;
  subtitle?: string;
  title: string;
  type: LarkObjectType;
  url?: string;
};

type JsonRecord = Record<string, unknown>;

const SEARCH_TIMEOUT_MS = 30_000;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseJsonObject(value: string): JsonRecord {
  try {
    const parsed = JSON.parse(value) as unknown;
    return asRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

function getNestedString(record: JsonRecord, path: string[]): string | undefined {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) {
      return undefined;
    }
    current = currentRecord[key];
  }
  return asString(current);
}

function collectArray(root: JsonRecord, keys: string[]): JsonRecord[] {
  for (const key of keys) {
    const value = root[key];
    const records = asArray(value).map(asRecord).filter((item): item is JsonRecord => item !== null);
    if (records.length > 0) {
      return records;
    }
  }
  const data = asRecord(root.data);
  if (data) {
    return collectArray(data, keys);
  }
  return [];
}

export function buildContactResult(item: JsonRecord): LarkObjectSearchResult | null {
  const id = asString(item.open_id) ?? asString(item.openId) ?? asString(item.user_id) ?? asString(item.userId);
  const title =
    asString(item.name) ??
    asString(item.localized_name) ??
    asString(item.localizedName) ??
    getNestedString(item, ['localized_name', 'zh_cn']) ??
    getNestedString(item, ['localizedName', 'zh_cn']) ??
    asString(item.en_name) ??
    id;
  if (!id || !title) {
    return null;
  }
  const email = asString(item.email) ?? asString(item.enterprise_email);
  return {
    id,
    reference: `@[联系人:${title}](open_id=${id})`,
    subtitle: email,
    title,
    type: 'contact',
  };
}

export function buildChatResult(item: JsonRecord): LarkObjectSearchResult | null {
  const id = asString(item.chat_id) ?? asString(item.chatId) ?? asString(item.id);
  const title = asString(item.name) ?? asString(item.chat_name) ?? asString(item.chatName) ?? id;
  if (!id || !title) {
    return null;
  }
  const chatMode = asString(item.chat_mode) ?? asString(item.chatMode);
  return {
    id,
    reference: `@[群:${title}](chat_id=${id})`,
    subtitle: chatMode,
    title,
    type: 'chat',
  };
}

export function buildDocumentResult(item: JsonRecord): LarkObjectSearchResult | null {
  const meta = asRecord(item.result_meta) ?? asRecord(item.resultMeta) ?? {};
  const url = asString(item.url) ?? asString(item.link) ?? asString(meta.url) ?? asString(meta.link);
  const token =
    asString(item.token) ??
    asString(item.doc_token) ??
    asString(item.obj_token) ??
    asString(item.file_token) ??
    asString(meta.token) ??
    asString(meta.doc_token) ??
    asString(meta.obj_token) ??
    asString(meta.file_token);
  const id = token ?? url;
  const title = asString(item.title) ?? asString(item.name) ?? asString(item.title_highlighted)?.replace(/<\/?h>/g, '') ?? id;
  if (!id || !title) {
    return null;
  }
  const docType = asString(item.doc_type) ?? asString(item.type) ?? asString(meta.doc_types) ?? asString(item.entity_type);
  return {
    id,
    reference: url ? `@[文档:${title}](url=${url})` : `@[文档:${title}](token=${id})`,
    subtitle: docType,
    title,
    type: 'document',
    url,
  };
}

async function runJson(args: string[]): Promise<JsonRecord> {
  const result = await runLarkCli(args, { timeoutMs: SEARCH_TIMEOUT_MS });
  if (result.exitCode !== 0) {
    const message = result.stderr || result.stdout || 'lark-cli 搜索失败';
    throw new Error(`${classifyLarkCliError(message)}: ${message}`);
  }
  return parseJsonObject(result.stdout);
}

async function searchContacts(query: string, limit: number): Promise<LarkObjectSearchResult[]> {
  if (!query) {
    return [];
  }
  const json = await runJson(['contact', '+search-user', '--as', 'user', '--query', query, '--page-size', String(Math.min(limit, 30)), '--format', 'json']);
  return collectArray(json, ['users', 'items', 'data'])
    .map(buildContactResult)
    .filter((item): item is LarkObjectSearchResult => item !== null)
    .slice(0, limit);
}

async function searchChats(query: string, limit: number): Promise<LarkObjectSearchResult[]> {
  const json = await runJson([
    'im',
    '+chat-list',
    '--as',
    'user',
    '--page-size',
    String(Math.min(Math.max(limit * 4, 20), 100)),
    '--sort-type',
    'ByActiveTimeDesc',
    '--format',
    'json',
  ]);
  const keyword = query.toLowerCase();
  return collectArray(json, ['chats', 'items', 'data'])
    .map(buildChatResult)
    .filter((item): item is LarkObjectSearchResult => item !== null)
    .filter((item) => !keyword || item.title.toLowerCase().includes(keyword))
    .slice(0, limit);
}

async function searchDocuments(query: string, limit: number): Promise<LarkObjectSearchResult[]> {
  if (!query) {
    return [];
  }
  const json = await runJson([
    'drive',
    '+search',
    '--as',
    'user',
    '--query',
    query,
    '--page-size',
    String(Math.min(limit, 20)),
    '--format',
    'json',
  ]);
  return collectArray(json, ['results', 'items', 'files', 'docs', 'data'])
    .map(buildDocumentResult)
    .filter((item): item is LarkObjectSearchResult => item !== null)
    .slice(0, limit);
}

export async function searchLarkObjects(request: LarkObjectSearchRequest): Promise<LarkObjectSearchResult[]> {
  const query = request.query.trim();
  const limit = Math.min(Math.max(request.limit ?? 5, 1), 10);
  const types = request.types?.length ? request.types : ['chat', 'contact', 'document'];
  const tasks = types.map(async (type) => {
    if (type === 'chat') {
      return searchChats(query, limit);
    }
    if (type === 'contact') {
      return searchContacts(query, limit);
    }
    return searchDocuments(query, limit);
  });
  const settled = await Promise.allSettled(tasks);
  const results: LarkObjectSearchResult[] = [];
  const errors: string[] = [];
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(...item.value);
    } else {
      errors.push(item.reason instanceof Error ? item.reason.message : String(item.reason));
    }
  }
  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return results.slice(0, limit * types.length);
}
