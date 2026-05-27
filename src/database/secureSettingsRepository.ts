import { safeStorage } from 'electron';
import { getDatabase } from './connection';

export const SECURE_SETTING_KEYS = {
  larkAppId: 'lark_app_id',
  larkAppSecret: 'lark_app_secret',
  siliconflowApiKey: 'siliconflow_api_key',
} as const;

export type SecureSettingKey = (typeof SECURE_SETTING_KEYS)[keyof typeof SECURE_SETTING_KEYS];

type SecureSettingRow = {
  encrypted_value: Buffer;
};

export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function setSecureSetting(key: SecureSettingKey, value: string): void {
  if (!isSecureStorageAvailable()) {
    throw new Error('Electron safeStorage is not available on this device.');
  }

  const now = Date.now();
  const encryptedValue = safeStorage.encryptString(value);
  getDatabase()
    .prepare(
      `
        INSERT INTO secure_settings (key, encrypted_value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          encrypted_value = excluded.encrypted_value,
          updated_at = excluded.updated_at
      `
    )
    .run(key, encryptedValue, now, now);
}

export function getSecureSetting(key: SecureSettingKey): string | null {
  const row = getDatabase()
    .prepare('SELECT encrypted_value FROM secure_settings WHERE key = ?')
    .get(key) as SecureSettingRow | undefined;

  if (!row) {
    return null;
  }

  return safeStorage.decryptString(row.encrypted_value);
}

export function hasSecureSetting(key: SecureSettingKey): boolean {
  const row = getDatabase().prepare('SELECT 1 FROM secure_settings WHERE key = ?').get(key);
  return Boolean(row);
}

export function deleteSecureSetting(key: SecureSettingKey): void {
  getDatabase().prepare('DELETE FROM secure_settings WHERE key = ?').run(key);
}
