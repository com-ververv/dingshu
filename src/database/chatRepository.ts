import { getDatabase, generateId } from './connection';
import type { ChatToolEvent } from '../main/ai/events';

export type StoredChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'completed' | 'cancelled' | 'failed';
  error?: string;
  toolEvents: StoredToolEvent[];
  createdAt: number;
  updatedAt: number;
};

export type StoredToolEvent = {
  action?: string;
  approvalId?: string;
  riskSummary?: string;
  toolCallId: string;
  toolName: string;
  status: 'pending_confirmation' | 'running' | 'completed' | 'failed' | 'cancelled';
  targetPreview?: string;
  inputPreview: string;
  outputPreview?: string;
  errorMessage?: string;
  elapsedMs?: number;
};

export type ConversationSummary = {
  id: string;
  title: string;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  createdAt: number;
  updatedAt: number;
};

export type ConversationDetail = ConversationSummary & {
  messages: StoredChatMessage[];
};

type ConversationRow = {
  id: string;
  title: string;
  last_message_at: number | null;
  last_message_preview: string | null;
  created_at: number;
  updated_at: number;
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  parts_json: string;
  content_text: string | null;
  status: 'streaming' | 'completed' | 'failed' | 'cancelled';
  created_at: number;
  updated_at: number;
};

type ToolCallRow = {
  id: string;
  message_id: string | null;
  tool_name: string;
  input_json: string;
  output_json: string | null;
  status: 'pending_confirmation' | 'running' | 'completed' | 'failed' | 'cancelled';
  approval_id: string | null;
  error_message: string | null;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toConversationSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    lastMessageAt: row.last_message_at ?? undefined,
    lastMessagePreview: row.last_message_preview ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildTitleFromContent(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新对话';
  }
  return normalized.length > 30 ? `${normalized.slice(0, 30)}...` : normalized;
}

function buildPartsJson(content: string, error?: string): string {
  return JSON.stringify({
    text: content,
    error,
  });
}

function toToolEvent(row: ToolCallRow): StoredToolEvent {
  const input = parseJson<Record<string, unknown>>(row.input_json, {});
  const output = parseJson<Record<string, unknown>>(row.output_json, {});
  return {
    action: typeof input.action === 'string' ? input.action : undefined,
    approvalId: row.approval_id ?? undefined,
    riskSummary: typeof input.riskSummary === 'string' ? input.riskSummary : undefined,
    toolCallId: row.id,
    toolName: row.tool_name,
    status: row.status,
    targetPreview: typeof input.targetPreview === 'string' ? input.targetPreview : undefined,
    inputPreview: typeof input.inputPreview === 'string' ? input.inputPreview : row.input_json,
    outputPreview: typeof output.outputPreview === 'string' ? output.outputPreview : undefined,
    errorMessage: row.error_message ?? undefined,
    elapsedMs: typeof output.elapsedMs === 'number' ? output.elapsedMs : undefined,
  };
}

function updateConversationActivity(conversationId: string, content: string, now = Date.now()): void {
  const preview = content.replace(/\s+/g, ' ').trim().slice(0, 180);
  getDatabase()
    .prepare(
      `
        UPDATE conversations
        SET last_message_at = ?, last_message_preview = ?, updated_at = ?
        WHERE id = ?
      `
    )
    .run(now, preview, now, conversationId);
}

export function createConversation(initialContent?: string): ConversationSummary {
  const db = getDatabase();
  const now = Date.now();
  const id = generateId();
  const title = buildTitleFromContent(initialContent ?? '');
  db.prepare(
    `
      INSERT INTO conversations (
        id, title, system_prompt_version, last_message_at, last_message_preview, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(id, title, 1, initialContent ? now : null, initialContent ? initialContent.slice(0, 180) : null, now, now);

  return {
    id,
    title,
    lastMessageAt: initialContent ? now : undefined,
    lastMessagePreview: initialContent?.slice(0, 180),
    createdAt: now,
    updatedAt: now,
  };
}

export function ensureConversation(conversationId?: string, initialContent?: string): ConversationSummary {
  if (conversationId) {
    const existing = getDatabase()
      .prepare(
        `
          SELECT id, title, last_message_at, last_message_preview, created_at, updated_at
          FROM conversations
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .get(conversationId) as ConversationRow | undefined;
    if (existing) {
      return toConversationSummary(existing);
    }
  }
  return createConversation(initialContent);
}

export function listConversations(): ConversationSummary[] {
  const rows = getDatabase()
    .prepare(
      `
        SELECT id, title, last_message_at, last_message_preview, created_at, updated_at
        FROM conversations
        WHERE deleted_at IS NULL
        ORDER BY COALESCE(last_message_at, updated_at) DESC
        LIMIT 100
      `
    )
    .all() as ConversationRow[];

  return rows.map(toConversationSummary);
}

export function getConversation(conversationId: string): ConversationDetail | null {
  const db = getDatabase();
  const conversation = db
    .prepare(
      `
        SELECT id, title, last_message_at, last_message_preview, created_at, updated_at
        FROM conversations
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .get(conversationId) as ConversationRow | undefined;

  if (!conversation) {
    return null;
  }

  const messageRows = db
    .prepare(
      `
        SELECT id, role, parts_json, content_text, status, created_at, updated_at
        FROM messages
        WHERE conversation_id = ? AND superseded_at IS NULL AND role IN ('user', 'assistant')
        ORDER BY created_at ASC
      `
    )
    .all(conversationId) as MessageRow[];

  const toolRows = db
    .prepare(
      `
        SELECT id, message_id, tool_name, input_json, output_json, status, approval_id, error_message
        FROM tool_calls
        WHERE conversation_id = ? AND superseded_at IS NULL
        ORDER BY created_at ASC
      `
    )
    .all(conversationId) as ToolCallRow[];

  const toolsByMessageId = new Map<string, StoredToolEvent[]>();
  for (const row of toolRows) {
    if (!row.message_id) {
      continue;
    }
    const events = toolsByMessageId.get(row.message_id) ?? [];
    events.push(toToolEvent(row));
    toolsByMessageId.set(row.message_id, events);
  }

  return {
    ...toConversationSummary(conversation),
    messages: messageRows.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content_text ?? parseJson<{ text?: string }>(row.parts_json, {}).text ?? '',
      status: row.status,
      error: parseJson<{ error?: string }>(row.parts_json, {}).error,
      toolEvents: toolsByMessageId.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export function softDeleteConversation(conversationId: string): boolean {
  const now = Date.now();
  const result = getDatabase()
    .prepare('UPDATE conversations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(now, now, conversationId);
  return result.changes > 0;
}

export function renameConversation(conversationId: string, title: string): ConversationSummary | null {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!normalizedTitle) {
    return null;
  }

  const now = Date.now();
  const db = getDatabase();
  const result = db
    .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(normalizedTitle, now, conversationId);
  if (result.changes === 0) {
    return null;
  }

  const row = db
    .prepare(
      `
        SELECT id, title, last_message_at, last_message_preview, created_at, updated_at
        FROM conversations
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .get(conversationId) as ConversationRow | undefined;
  return row ? toConversationSummary(row) : null;
}

export function insertChatMessage(input: {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}): void {
  const now = Date.now();
  getDatabase()
    .prepare(
      `
        INSERT INTO messages (
          id, conversation_id, role, parts_schema_version, parts_json, content_text, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.id,
      input.conversationId,
      input.role,
      1,
      buildPartsJson(input.content, input.error),
      input.content,
      input.status,
      now,
      now
    );
  updateConversationActivity(input.conversationId, input.content, now);
}

export function updateChatMessage(input: {
  id: string;
  conversationId: string;
  content: string;
  status: 'streaming' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}): void {
  const now = Date.now();
  getDatabase()
    .prepare(
      `
        UPDATE messages
        SET parts_json = ?, content_text = ?, status = ?, updated_at = ?
        WHERE id = ? AND conversation_id = ?
      `
    )
    .run(buildPartsJson(input.content, input.error), input.content, input.status, now, input.id, input.conversationId);
  updateConversationActivity(input.conversationId, input.content, now);
}

export function upsertToolEvent(conversationId: string, messageId: string, event: ChatToolEvent): void {
  if (event.type === 'tool-call-start') {
    const now = Date.now();
    getDatabase()
      .prepare(
        `
          INSERT INTO tool_calls (
            id, conversation_id, message_id, tool_name, input_json, status, created_at, started_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            input_json = excluded.input_json,
            status = excluded.status,
            started_at = excluded.started_at
        `
      )
      .run(
        event.toolCallId,
        conversationId,
        messageId,
        event.toolName,
        JSON.stringify({ inputPreview: event.inputPreview }),
        'running',
        now,
        now
      );
    return;
  }

  if (event.type === 'tool-call-confirmation-required') {
    const now = Date.now();
    getDatabase()
      .prepare(
        `
          INSERT INTO tool_calls (
            id, conversation_id, message_id, tool_name, input_json, status, approval_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            input_json = excluded.input_json,
            status = excluded.status,
            approval_id = excluded.approval_id
        `
      )
      .run(
        event.toolCallId,
        conversationId,
        messageId,
        event.toolName,
        JSON.stringify({
          action: event.action,
          inputPreview: event.inputPreview,
          riskSummary: event.riskSummary,
          targetPreview: event.targetPreview,
        }),
        'pending_confirmation',
        event.approvalId,
        now
      );
    return;
  }

  const now = Date.now();
  getDatabase()
    .prepare(
      `
        UPDATE tool_calls
        SET status = ?, output_json = ?, error_message = ?, finished_at = ?
        WHERE id = ? AND conversation_id = ?
      `
    )
    .run(
      event.status,
      JSON.stringify({ outputPreview: event.outputPreview, elapsedMs: event.elapsedMs }),
      event.errorMessage ?? null,
      now,
      event.toolCallId,
      conversationId
    );
}
