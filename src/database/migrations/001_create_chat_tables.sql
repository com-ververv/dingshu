CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  system_prompt_version INTEGER NOT NULL,
  last_message_at INTEGER,
  last_message_preview TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  parts_schema_version INTEGER NOT NULL,
  parts_json TEXT NOT NULL,
  content_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('streaming', 'completed', 'failed', 'cancelled')),
  superseded_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_confirmation', 'running', 'completed', 'failed', 'cancelled')),
  approval_id TEXT,
  error_message TEXT,
  superseded_at INTEGER,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_status ON messages(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_superseded_at ON messages(conversation_id, superseded_at);
CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation_started_at ON tool_calls(conversation_id, started_at);
CREATE INDEX IF NOT EXISTS idx_tool_calls_approval_id ON tool_calls(approval_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_message_superseded_at ON tool_calls(message_id, superseded_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
