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

export interface SecureSettingsStatus {
  larkAppIdConfigured: boolean;
  larkAppSecretConfigured: boolean;
  larkAuth: {
    configured: boolean;
    profilePath: string;
  };
  safeStorageAvailable: boolean;
  siliconflowApiKeyConfigured: boolean;
}

export interface SecureSettingsAPI {
  getStatus: () => Promise<IPCResponse<SecureSettingsStatus>>;
  saveCredentials: (credentials: {
    larkAppId?: string;
    larkAppSecret?: string;
    siliconflowApiKey?: string;
  }) => Promise<IPCResponse<void>>;
  clearCredential: (key: 'larkAppId' | 'larkAppSecret' | 'siliconflowApiKey') => Promise<IPCResponse<void>>;
}

export interface LarkAuthStartResult {
  deviceCode?: string;
  userCode?: string;
  verificationUrl?: string;
}

export interface LarkAuthAPI {
  start: (scope?: string) => Promise<IPCResponse<LarkAuthStartResult>>;
  complete: (deviceCode: string) => Promise<IPCResponse<void>>;
}

export interface LarkCliInfo {
  ok: boolean;
  executable: string;
  packageRoot?: string;
  sha256?: string;
  error?: string;
}

export interface LarkCapabilityInfo {
  description: string;
  domain: string;
  id: string;
  risk: 'read' | 'write';
  shortcut: string;
}

export interface LarkCliAPI {
  getInfo: () => Promise<IPCResponse<LarkCliInfo>>;
  listCapabilities: () => Promise<IPCResponse<LarkCapabilityInfo[]>>;
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
  conversationId?: string;
  requestId: string;
  type: 'delta';
  textDelta: string;
}

export interface ChatDoneEvent {
  conversationId?: string;
  requestId: string;
  type: 'done';
  finishReason?: string;
  usage?: unknown;
}

export interface ChatErrorEvent {
  conversationId?: string;
  requestId: string;
  type: 'error';
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface ChatToolCallStartEvent {
  conversationId?: string;
  requestId: string;
  type: 'tool-call-start';
  toolCallId: string;
  toolName: string;
  inputPreview: string;
}

export interface ChatToolCallResultEvent {
  conversationId?: string;
  requestId: string;
  type: 'tool-call-result';
  toolCallId: string;
  toolName: string;
  status: 'completed' | 'failed' | 'cancelled';
  outputPreview?: string;
  errorMessage?: string;
  elapsedMs: number;
}

export interface ChatToolCallConfirmationRequiredEvent {
  conversationId?: string;
  requestId: string;
  type: 'tool-call-confirmation-required';
  approvalId: string;
  toolCallId: string;
  toolName: string;
  action: string;
  riskSummary: string;
  inputPreview: string;
  targetPreview?: string;
}

export interface ChatStoredToolEvent {
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
}

export interface ChatStoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'completed' | 'cancelled' | 'failed';
  error?: string;
  toolEvents: ChatStoredToolEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatConversationDetail extends ChatConversationSummary {
  messages: ChatStoredMessage[];
}

export interface ChatAPI {
  listConversations: () => Promise<IPCResponse<ChatConversationSummary[]>>;
  getConversation: (conversationId: string) => Promise<IPCResponse<ChatConversationDetail>>;
  deleteConversation: (conversationId: string) => Promise<IPCResponse<void>>;
  send: (request: {
    assistantMessageId?: string;
    conversationId?: string;
    requestId: string;
    messages: ChatMessage[];
    userMessage?: {
      id: string;
      content: string;
    };
  }) => Promise<IPCResponse<{ conversationId: string; assistantMessageId: string }>>;
  stop: (requestId: string) => Promise<IPCResponse<void>>;
  approveToolCall: (approvalId: string) => Promise<IPCResponse<void>>;
  rejectToolCall: (approvalId: string, reason?: string) => Promise<IPCResponse<void>>;
  onDelta: (callback: (event: ChatDeltaEvent) => void) => void;
  onDone: (callback: (event: ChatDoneEvent) => void) => void;
  onError: (callback: (event: ChatErrorEvent) => void) => void;
  onToolCallStart: (callback: (event: ChatToolCallStartEvent) => void) => void;
  onToolCallResult: (callback: (event: ChatToolCallResultEvent) => void) => void;
  onToolCallConfirmationRequired: (callback: (event: ChatToolCallConfirmationRequiredEvent) => void) => void;
  removeStreamListeners: () => void;
}

/**
 * Main window API interface
 */
export interface WindowAPI {
  settings: SettingsAPI;
  secureSettings: SecureSettingsAPI;
  larkAuth: LarkAuthAPI;
  larkCli: LarkCliAPI;
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
