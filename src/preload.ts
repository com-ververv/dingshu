/**
 * Preload script for Desktop Starter App
 *
 * Exposes the API to the renderer process via contextBridge.
 * This file runs in a sandboxed context with access to Node.js APIs.
 *
 * Add your own APIs following the pattern below.
 */

import { contextBridge, ipcRenderer } from 'electron';

type ChatStreamEvent =
  | { conversationId?: string; requestId: string; type: 'delta'; textDelta: string }
  | { conversationId?: string; requestId: string; type: 'done'; finishReason?: string; usage?: unknown }
  | {
      conversationId?: string;
      requestId: string;
      type: 'error';
      error: { code: string; message: string; recoverable: boolean };
    }
  | {
      requestId: string;
      conversationId?: string;
      type: 'tool-call-start';
      toolCallId: string;
      toolName: string;
      inputPreview: string;
    }
  | {
      requestId: string;
      conversationId?: string;
      type: 'tool-call-result';
      toolCallId: string;
      toolName: string;
      status: 'completed' | 'failed' | 'cancelled';
      outputPreview?: string;
      errorMessage?: string;
      elapsedMs: number;
    }
  | {
      requestId: string;
      conversationId?: string;
      type: 'tool-call-confirmation-required';
      approvalId: string;
      toolCallId: string;
      toolName: string;
      action: string;
      riskSummary: string;
      inputPreview: string;
      targetPreview?: string;
    };

// Settings API
const settingsAPI = {
  get: (key: string) => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAll: () => ipcRenderer.invoke('settings:getAll'),
};

const secureSettingsAPI = {
  getStatus: () => ipcRenderer.invoke('secureSettings:getStatus'),
  saveCredentials: (credentials: { larkAppId?: string; larkAppSecret?: string; siliconflowApiKey?: string }) =>
    ipcRenderer.invoke('secureSettings:saveCredentials', credentials),
  clearCredential: (key: 'larkAppId' | 'larkAppSecret' | 'siliconflowApiKey') =>
    ipcRenderer.invoke('secureSettings:clearCredential', key),
};

const larkAuthAPI = {
  start: (scope?: string) => ipcRenderer.invoke('larkAuth:start', scope),
  complete: (deviceCode: string) => ipcRenderer.invoke('larkAuth:complete', deviceCode),
};

// Dialog API
const dialogAPI = {
  showSaveDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),
};

// Shell API
const shellAPI = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
};

// Database API
const databaseAPI = {
  getInfo: () => ipcRenderer.invoke('database:getInfo'),
  migrateToDocuments: () => ipcRenderer.invoke('database:migrateToDocuments'),
  showInFinder: () => ipcRenderer.invoke('database:showInFinder'),
  selectExisting: () => ipcRenderer.invoke('database:selectExisting'),
};

// App API
const appAPI = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update:available', (_, version) => callback(version));
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update:downloaded', (_, version) => callback(version));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update:available');
    ipcRenderer.removeAllListeners('update:downloaded');
  },
};

// Chat API
const chatAPI = {
  listConversations: () => ipcRenderer.invoke('chat:listConversations'),
  getConversation: (conversationId: string) => ipcRenderer.invoke('chat:getConversation', conversationId),
  deleteConversation: (conversationId: string) => ipcRenderer.invoke('chat:deleteConversation', conversationId),
  send: (request: {
    assistantMessageId?: string;
    conversationId?: string;
    requestId: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    userMessage?: {
      id: string;
      content: string;
    };
  }) => ipcRenderer.invoke('chat:send', request),
  stop: (requestId: string) => ipcRenderer.invoke('chat:stop', requestId),
  approveToolCall: (approvalId: string) => ipcRenderer.invoke('chat:approveToolCall', approvalId),
  rejectToolCall: (approvalId: string, reason?: string) => ipcRenderer.invoke('chat:rejectToolCall', approvalId, reason),
  onDelta: (callback: (event: Extract<ChatStreamEvent, { type: 'delta' }>) => void) => {
    ipcRenderer.on('chat:delta', (_, event) => callback(event));
  },
  onDone: (callback: (event: Extract<ChatStreamEvent, { type: 'done' }>) => void) => {
    ipcRenderer.on('chat:done', (_, event) => callback(event));
  },
  onError: (callback: (event: Extract<ChatStreamEvent, { type: 'error' }>) => void) => {
    ipcRenderer.on('chat:error', (_, event) => callback(event));
  },
  onToolCallStart: (callback: (event: Extract<ChatStreamEvent, { type: 'tool-call-start' }>) => void) => {
    ipcRenderer.on('chat:tool-call-start', (_, event) => callback(event));
  },
  onToolCallResult: (callback: (event: Extract<ChatStreamEvent, { type: 'tool-call-result' }>) => void) => {
    ipcRenderer.on('chat:tool-call-result', (_, event) => callback(event));
  },
  onToolCallConfirmationRequired: (
    callback: (event: Extract<ChatStreamEvent, { type: 'tool-call-confirmation-required' }>) => void
  ) => {
    ipcRenderer.on('chat:tool-call-confirmation-required', (_, event) => callback(event));
  },
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('chat:delta');
    ipcRenderer.removeAllListeners('chat:done');
    ipcRenderer.removeAllListeners('chat:error');
    ipcRenderer.removeAllListeners('chat:tool-call-start');
    ipcRenderer.removeAllListeners('chat:tool-call-result');
    ipcRenderer.removeAllListeners('chat:tool-call-confirmation-required');
  },
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('api', {
  settings: settingsAPI,
  secureSettings: secureSettingsAPI,
  larkAuth: larkAuthAPI,
  dialog: dialogAPI,
  shell: shellAPI,
  database: databaseAPI,
  app: appAPI,
  chat: chatAPI,
});

// Add your own APIs below:
// const myFeatureAPI = {
//   doSomething: (arg: string) => ipcRenderer.invoke('myFeature:doSomething', arg),
// };
// Then add to exposeInMainWorld: myFeature: myFeatureAPI,
