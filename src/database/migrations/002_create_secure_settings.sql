CREATE TABLE IF NOT EXISTS secure_settings (
  key TEXT PRIMARY KEY,
  encrypted_value BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
