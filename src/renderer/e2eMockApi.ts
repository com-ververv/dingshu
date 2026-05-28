import type {
  ChatAPI,
  ChatConversationDetail,
  ChatConversationSummary,
  ChatDeltaEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatToolCallConfirmationRequiredEvent,
  ChatToolCallResultEvent,
  ChatToolCallStartEvent,
  IPCResponse,
  LarkObjectSearchResult,
  WindowAPI,
} from '../types/window';

type ListenerMap = {
  delta: Set<(event: ChatDeltaEvent) => void>;
  done: Set<(event: ChatDoneEvent) => void>;
  error: Set<(event: ChatErrorEvent) => void>;
  toolCallStart: Set<(event: ChatToolCallStartEvent) => void>;
  toolCallResult: Set<(event: ChatToolCallResultEvent) => void>;
  toolCallConfirmationRequired: Set<(event: ChatToolCallConfirmationRequiredEvent) => void>;
};

const ok = <T>(data: T): IPCResponse<T> => ({ success: true, data });

function createE2EChatAPI(): ChatAPI {
  let conversationCounter = 0;
  const now = Date.now();
  const conversations = new Map<string, ChatConversationDetail>([
    [
      'e2e-interrupted',
      {
        id: 'e2e-interrupted',
        title: '中断恢复会话',
        lastMessageAt: now - 1000,
        lastMessagePreview: '上次生成已中断，可点击下方按钮重新发送上一条。',
        createdAt: now - 2000,
        updatedAt: now - 1000,
        messages: [
          {
            id: 'e2e-interrupted-user',
            role: 'user',
            content: '请生成一段长内容',
            status: 'completed',
            toolEvents: [],
            createdAt: now - 2000,
            updatedAt: now - 2000,
          },
          {
            id: 'e2e-interrupted-assistant',
            role: 'assistant',
            content: '正在连接模型...',
            status: 'streaming',
            toolEvents: [],
            createdAt: now - 1500,
            updatedAt: now - 1000,
          },
        ],
      },
    ],
  ]);
  let pendingApproval:
    | {
        conversationId: string;
        requestId: string;
        toolCallId: string;
      }
    | undefined;
  const listeners: ListenerMap = {
    delta: new Set(),
    done: new Set(),
    error: new Set(),
    toolCallStart: new Set(),
    toolCallResult: new Set(),
    toolCallConfirmationRequired: new Set(),
  };

  return {
    listConversations: async () =>
      ok(
        [...conversations.values()]
          .map<ChatConversationSummary>(({ messages: _messages, ...summary }) => summary)
          .sort((a, b) => b.updatedAt - a.updatedAt)
      ),
    getConversation: async (conversationId) => {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        return { success: false, error: { code: 'E2E_NOT_FOUND', message: 'Mock conversation not found' } };
      }
      return ok(conversation);
    },
    deleteConversation: async (conversationId) => {
      conversations.delete(conversationId);
      return ok(undefined);
    },
    renameConversation: async (conversationId, title) => {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        return { success: false, error: { code: 'E2E_NOT_FOUND', message: 'Mock conversation not found' } };
      }
      const updated = { ...conversation, title, updatedAt: Date.now() };
      conversations.set(conversationId, updated);
      const { messages: _messages, ...summary } = updated;
      return ok(summary);
    },
    send: async (request) => {
      const userContent =
        request.userMessage?.content ??
        [...request.messages]
          .reverse()
          .find((message) => message.role === 'user')
          ?.content ??
        '';
      const now = Date.now();
      const conversationId = request.conversationId ?? `e2e-conversation-${++conversationCounter}`;
      const assistantMessageId = request.assistantMessageId ?? `e2e-assistant-${conversationCounter}`;
      const isApprovalFlow =
        userContent.includes('审批拒绝') || userContent.includes('创建飞书文档') || userContent.includes('发送飞书消息');
      const isSendApproval = userContent.includes('发送飞书消息');
      const response = `E2E mock response for: ${userContent}`;

      conversations.set(conversationId, {
        id: conversationId,
        title: userContent.slice(0, 40) || 'E2E conversation',
        lastMessageAt: now,
        lastMessagePreview: userContent,
        createdAt: conversations.get(conversationId)?.createdAt ?? now,
        updatedAt: now,
        messages: [
          {
            id: request.userMessage?.id ?? `e2e-user-${conversationCounter}`,
            role: 'user',
            content: userContent,
            status: 'completed',
            toolEvents: [],
            createdAt: now,
            updatedAt: now,
          },
          {
            id: assistantMessageId,
            role: 'assistant',
            content: response,
            status: 'completed',
            toolEvents: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      window.setTimeout(() => {
        if (isApprovalFlow) {
          const toolCallId = `e2e-tool-${conversationCounter}`;
          const approvalId = `e2e-approval-${conversationCounter}`;
          const toolName = isSendApproval ? 'lark_message_send' : 'lark_doc_create';
          pendingApproval = {
            conversationId,
            requestId: request.requestId,
            toolCallId,
          };
          listeners.toolCallConfirmationRequired.forEach((listener) =>
            listener({
              action: isSendApproval ? '发送飞书消息' : '创建飞书云文档',
              approvalId,
              conversationId,
              inputPreview: isSendApproval
                ? '{"chat":"研发群","content":"E2E消息"}'
                : '{"title":"E2E审批拒绝","contentPreview":"E2E"}',
              requestId: request.requestId,
              riskSummary: isSendApproval
                ? '这会使用飞书机器人向目标群发送消息。'
                : '这会使用你的飞书账号创建一篇新的云文档。',
              targetPreview: isSendApproval ? '研发群' : 'E2E审批拒绝',
              toolCallId,
              toolName,
              type: 'tool-call-confirmation-required',
            })
          );
          return;
        }
        listeners.delta.forEach((listener) =>
          listener({
            conversationId,
            requestId: request.requestId,
            type: 'delta',
            textDelta: response,
          })
        );
        window.setTimeout(() => {
          listeners.done.forEach((listener) =>
            listener({
              conversationId,
              requestId: request.requestId,
              type: 'done',
              finishReason: 'mock',
            })
          );
        }, 30);
      }, 30);

      return ok({ conversationId, assistantMessageId });
    },
    stop: async () => ok(undefined),
    approveToolCall: async () => ok(undefined),
    rejectToolCall: async () => {
      const approval = pendingApproval;
      pendingApproval = undefined;
      if (!approval) {
        return { success: false, error: { code: 'E2E_APPROVAL_NOT_FOUND', message: 'Mock approval not found' } };
      }
      window.setTimeout(() => {
        listeners.toolCallResult.forEach((listener) =>
          listener({
            conversationId: approval.conversationId,
            elapsedMs: 25,
            outputPreview: '{"ok":false,"denied":true}',
            requestId: approval.requestId,
            status: 'cancelled',
            toolCallId: approval.toolCallId,
            toolName: 'lark_doc_create',
            type: 'tool-call-result',
          })
        );
        window.setTimeout(() => {
          const finalText = '创建操作已被取消，文档未生成。';
          listeners.delta.forEach((listener) =>
            listener({
              conversationId: approval.conversationId,
              requestId: approval.requestId,
              textDelta: finalText,
              type: 'delta',
            })
          );
          listeners.done.forEach((listener) =>
            listener({
              conversationId: approval.conversationId,
              finishReason: 'mock',
              requestId: approval.requestId,
              type: 'done',
            })
          );
        }, 10);
      }, 10);
      return ok(undefined);
    },
    onDelta: (callback) => {
      listeners.delta.add(callback);
    },
    onDone: (callback) => {
      listeners.done.add(callback);
    },
    onError: (callback) => {
      listeners.error.add(callback);
    },
    onToolCallStart: (callback) => {
      listeners.toolCallStart.add(callback);
    },
    onToolCallResult: (callback) => {
      listeners.toolCallResult.add(callback);
    },
    onToolCallConfirmationRequired: (callback) => {
      listeners.toolCallConfirmationRequired.add(callback);
    },
    removeStreamListeners: () => {
      Object.values(listeners).forEach((listenerSet) => listenerSet.clear());
    },
  };
}

export function installE2EMockApi(): void {
  const larkResults: LarkObjectSearchResult[] = [
    {
      id: 'mock-doc-1',
      reference: 'doc:mock-doc-1',
      title: '测试相关的文档',
      type: 'document',
      url: 'https://example.test/doc/mock-doc-1',
    },
  ];

  const api: WindowAPI = {
    settings: {
      get: async () => ok(null),
      set: async () => ok(undefined),
      getAll: async () => ok({}),
    },
    secureSettings: {
      getStatus: async () => {
        const healthy = window.localStorage.getItem('e2eSecureStatus') === 'healthy';
        return ok({
          larkAppIdConfigured: healthy,
          larkAppIdHealthy: healthy,
          larkAppSecretConfigured: healthy,
          larkAppSecretHealthy: healthy,
          larkAuth: {
            configured: true,
            profilePath: 'e2e/mock-lark-profile',
          },
          safeStorageAvailable: true,
          siliconflowApiKeyConfigured: true,
          siliconflowApiKeyHealthy: healthy,
          credentialErrors: healthy
            ? {}
            : {
                siliconflowApiKey: 'mock decrypt failed',
              },
        });
      },
      saveCredentials: async () => ok(undefined),
      clearCredential: async () => ok(undefined),
    },
    larkAuth: {
      start: async () => ok({ deviceCode: 'mock-device-code', userCode: 'MOCK', verificationUrl: 'https://example.test/auth' }),
      complete: async () => ok(undefined),
    },
    larkCli: {
      getInfo: async () => ok({ ok: true, executable: 'mock-lark-cli' }),
      listCapabilities: async () => ok([]),
    },
    larkObject: {
      search: async () => ok(larkResults),
    },
    dialog: {
      showSaveDialog: async () => undefined,
      showOpenDialog: async () => undefined,
    },
    shell: {
      openExternal: async () => undefined,
      showItemInFolder: async () => undefined,
    },
    database: {
      getInfo: async () =>
        ok({
          currentPath: 'e2e/app.db',
          isLegacyLocation: false,
          canMigrate: false,
          legacyPath: 'e2e/legacy.db',
          defaultPath: 'e2e/app.db',
        }),
      migrateToDocuments: async () => ok({ oldPath: 'e2e/legacy.db', newPath: 'e2e/app.db' }),
      showInFinder: async () => ok(undefined),
      selectExisting: async () => ok({ newPath: 'e2e/app.db' }),
    },
    app: {
      getVersion: async () => ok('e2e'),
      quitAndInstall: async () => ok(undefined),
      onUpdateAvailable: () => undefined,
      onUpdateDownloaded: () => undefined,
      removeUpdateListeners: () => undefined,
    },
    chat: createE2EChatAPI(),
  };

  Object.defineProperty(window, 'api', {
    configurable: true,
    value: api,
  });
}
