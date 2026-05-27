/**
 * Window API Types
 *
 * Type definitions for the window.api object exposed via preload.
 * Add your own API types following the pattern below.
 */

export interface IPCError {
  message: string;
  code?: string;
}

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: IPCError;
}

/**
 * Settings API exposed to renderer process
 */
export interface SettingsAPI {
  get: (key: string) => Promise<IPCResponse<string | null>>;
  set: (key: string, value: string) => Promise<IPCResponse<void>>;
  getAll: () => Promise<IPCResponse<Record<string, string>>>;
}

/**
 * Dialog API for native dialogs
 */
export interface DialogAPI {
  showSaveDialog: (options?: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | undefined>;
  showOpenDialog: (options?: {
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }) => Promise<string[] | undefined>;
}

/**
 * Shell API for external operations
 */
export interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<void>;
}

/**
 * Database location info
 */
export interface DatabaseInfo {
  currentPath: string;
  isLegacyLocation: boolean;
  canMigrate: boolean;
  legacyPath: string;
  defaultPath: string;
}

/**
 * Database API for managing database location
 */
export interface DatabaseAPI {
  getInfo: () => Promise<IPCResponse<DatabaseInfo>>;
  migrateToDocuments: () => Promise<IPCResponse<{ oldPath: string; newPath: string }>>;
  showInFinder: () => Promise<IPCResponse<void>>;
  selectExisting: () => Promise<IPCResponse<{ newPath: string }>>;
}

/**
 * App API for application information
 */
export interface AppAPI {
  getVersion: () => Promise<IPCResponse<string>>;
  quitAndInstall: () => Promise<IPCResponse<void>>;
  onUpdateAvailable: (callback: (version: string) => void) => void;
  onUpdateDownloaded: (callback: (version: string) => void) => void;
  removeUpdateListeners: () => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatDeltaEvent {
  requestId: string;
  type: 'delta';
  textDelta: string;
}

export interface ChatDoneEvent {
  requestId: string;
  type: 'done';
  finishReason?: string;
  usage?: unknown;
}

export interface ChatErrorEvent {
  requestId: string;
  type: 'error';
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface ChatAPI {
  send: (request: { requestId: string; messages: ChatMessage[] }) => Promise<IPCResponse<void>>;
  stop: (requestId: string) => Promise<IPCResponse<void>>;
  onDelta: (callback: (event: ChatDeltaEvent) => void) => void;
  onDone: (callback: (event: ChatDoneEvent) => void) => void;
  onError: (callback: (event: ChatErrorEvent) => void) => void;
  removeStreamListeners: () => void;
}

/**
 * Main window API interface
 */
export interface WindowAPI {
  settings: SettingsAPI;
  dialog: DialogAPI;
  shell: ShellAPI;
  database: DatabaseAPI;
  app: AppAPI;
  chat: ChatAPI;
}

declare global {
  interface Window {
    api: WindowAPI;
  }
}
