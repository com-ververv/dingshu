/**
 * Pexar Lark Agent - Chatbot UI
 */

import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  RotateCcw,
  Search,
  Send,
  Settings,
  Square,
  UserRound,
  XCircle,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { Settings as SettingsModal } from './components/Settings';
import type { ChatConversationSummary, SecureSettingsStatus } from '../types/window';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'completed' | 'cancelled' | 'failed';
  error?: string;
  toolEvents?: ToolEvent[];
};

type ToolEvent = {
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

const suggestedPrompts = [
  '把这段内容创建为飞书文档',
  '总结一下「研发群」今天的讨论',
  '找一下上周的评估报告',
  '给某人发送一条飞书消息',
];

const DRAFT_PREFIX = 'pexar-lark-agent:draft:';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getMessagesForModel(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function getToolLabel(toolName: string): string {
  if (toolName === 'lark_doc_create') {
    return '创建飞书文档';
  }
  if (toolName === 'lark_doc_read') {
    return '读取飞书文档';
  }
  if (toolName === 'lark_doc_search') {
    return '搜索飞书文档';
  }
  if (toolName === 'lark_message_search') {
    return '查询飞书消息';
  }
  if (toolName === 'lark_message_send') {
    return '发送飞书消息';
  }
  if (toolName === 'lark_cli_shortcut') {
    return '飞书扩展能力';
  }
  return toolName;
}

function formatElapsed(elapsedMs?: number): string {
  if (elapsedMs === undefined) {
    return '';
  }
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function getConversationTimeGroup(timestamp?: number): string {
  if (!timestamp) {
    return '更早';
  }
  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - startOfDate) / 86_400_000);

  if (diffDays <= 0) {
    return '今天';
  }
  if (diffDays === 1) {
    return '昨天';
  }
  if (diffDays <= 7) {
    return '近 7 天';
  }
  if (diffDays <= 30) {
    return '近 30 天';
  }
  return '更早';
}

function formatConversationTime(timestamp?: number): string {
  if (!timestamp) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function getConfigItems(status: SecureSettingsStatus | null) {
  return [
    {
      label: '模型',
      ok: status?.siliconflowApiKeyConfigured === true,
    },
    {
      label: '飞书应用',
      ok: status?.larkAppIdConfigured === true && status?.larkAppSecretConfigured === true,
    },
    {
      label: '飞书授权',
      ok: status?.larkAuth.configured === true,
    },
  ];
}

function getDraftKey(conversationId: string | null): string {
  return `${DRAFT_PREFIX}${conversationId ?? 'new'}`;
}

function ToolEventList({
  events,
  onApprove,
  onReject,
}: {
  events: ToolEvent[];
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="tool-event-list">
      {events.map((event) => (
        <details key={event.toolCallId} className={`tool-event is-${event.status}`} open={event.status === 'running'}>
          <summary>
            <span className="tool-event-icon">
              {event.status === 'pending_confirmation' || event.status === 'running' ? (
                <Search size={14} />
              ) : event.status === 'completed' ? (
                <CheckCircle2 size={14} />
              ) : (
                <XCircle size={14} />
              )}
            </span>
            <span>{getToolLabel(event.toolName)}</span>
            <span className="tool-event-status">{event.status}</span>
            {event.elapsedMs !== undefined ? <span className="tool-event-elapsed">{formatElapsed(event.elapsedMs)}</span> : null}
          </summary>
          <div className="tool-event-detail">
            {event.action ? (
              <p>
                <strong>动作</strong>：{event.action}
              </p>
            ) : null}
            {event.targetPreview ? (
              <p>
                <strong>目标</strong>：{event.targetPreview}
              </p>
            ) : null}
            {event.riskSummary ? <p className="tool-event-risk">{event.riskSummary}</p> : null}
            <p>
              <strong>输入</strong>
            </p>
            <pre>{event.inputPreview}</pre>
            {event.outputPreview ? (
              <>
                <p>
                  <strong>结果</strong>
                </p>
                <pre>{event.outputPreview}</pre>
              </>
            ) : null}
            {event.errorMessage ? <p className="tool-event-error">{event.errorMessage}</p> : null}
            {event.status === 'pending_confirmation' && event.approvalId ? (
              <div className="tool-approval-actions">
                <button type="button" className="primary-button" onClick={() => onApprove(event.approvalId!)}>
                  确认执行
                </button>
                <button type="button" className="secondary-text-button" onClick={() => onReject(event.approvalId!)}>
                  取消
                </button>
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [secureStatus, setSecureStatus] = useState<SecureSettingsStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationSearchRef = useRef<HTMLInputElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  const isStreaming = activeRequestId !== null;
  const canSend = input.trim().length > 0 && !isStreaming && secureStatus?.siliconflowApiKeyConfigured !== false;

  const modelMessages = useMemo(() => getMessagesForModel(messages), [messages]);
  const filteredConversationGroups = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();
    const filtered = keyword
      ? conversations.filter((conversation) =>
          `${conversation.title} ${conversation.lastMessagePreview ?? ''}`.toLowerCase().includes(keyword)
        )
      : conversations;
    const groups = new Map<string, ChatConversationSummary[]>();
    for (const conversation of filtered) {
      const group = getConversationTimeGroup(conversation.lastMessageAt ?? conversation.updatedAt);
      groups.set(group, [...(groups.get(group) ?? []), conversation]);
    }
    return ['今天', '昨天', '近 7 天', '近 30 天', '更早']
      .map((label) => ({ label, conversations: groups.get(label) ?? [] }))
      .filter((group) => group.conversations.length > 0);
  }, [conversationSearch, conversations]);
  const configItems = useMemo(() => getConfigItems(secureStatus), [secureStatus]);
  const hasPendingApproval = messages.some((message) =>
    message.toolEvents?.some((event) => event.status === 'pending_confirmation')
  );

  async function refreshConversations(nextActiveId?: string) {
    const result = await window.api.chat.listConversations();
    if (!result.success) {
      toast.error(result.error?.message ?? '加载会话列表失败');
      setConversationsLoaded(true);
      return;
    }
    setConversations(result.data ?? []);
    if (nextActiveId !== undefined) {
      setConversationId(nextActiveId);
    }
    setConversationsLoaded(true);
  }

  async function loadConversation(nextConversationId: string) {
    if (isStreaming) {
      toast.warning('请先停止当前生成');
      return;
    }
    const result = await window.api.chat.getConversation(nextConversationId);
    if (!result.success || !result.data) {
      toast.error(result.error?.message ?? '加载会话失败');
      return;
    }
    setConversationId(result.data.id);
    setInput(localStorage.getItem(getDraftKey(result.data.id)) ?? '');
    setMessages(
      result.data.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status,
        error: message.error,
        toolEvents: message.toolEvents,
      }))
    );
    setStatusText('Ready');
  }

  function startNewConversation() {
    if (isStreaming) {
      toast.warning('请先停止当前生成');
      return;
    }
    setConversationId(null);
    setMessages([]);
    setInput(localStorage.getItem(getDraftKey(null)) ?? '');
    setStatusText('Ready');
  }

  async function deleteConversation(targetConversationId: string) {
    if (isStreaming && targetConversationId === conversationId) {
      toast.warning('请先停止当前生成');
      return;
    }
    const result = await window.api.chat.deleteConversation(targetConversationId);
    if (!result.success) {
      toast.error(result.error?.message ?? '删除会话失败');
      return;
    }
    if (targetConversationId === conversationId) {
      setConversationId(null);
      setMessages([]);
      setInput(localStorage.getItem(getDraftKey(null)) ?? '');
    }
    await refreshConversations(targetConversationId === conversationId ? undefined : conversationId ?? undefined);
  }

  useEffect(() => {
    window.api.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setAppVersion(result.data);
      }
    });
    window.api.secureSettings.getStatus().then((result) => {
      if (result.success && result.data) {
        setSecureStatus(result.data);
      }
    });
  }, []);

  useEffect(() => {
    if (conversationsLoaded) {
      return;
    }
    window.api.chat.listConversations().then((result) => {
      if (!result.success) {
        toast.error(result.error?.message ?? '加载会话列表失败');
        setConversationsLoaded(true);
        return;
      }
      const recentConversations = result.data ?? [];
      setConversations(recentConversations);
      setConversationsLoaded(true);
      if (!conversationId && recentConversations[0]) {
        window.api.chat.getConversation(recentConversations[0].id).then((conversationResult) => {
          if (!conversationResult.success || !conversationResult.data) {
            toast.error(conversationResult.error?.message ?? '加载最近会话失败');
            return;
          }
          setConversationId(conversationResult.data.id);
          setInput(localStorage.getItem(getDraftKey(conversationResult.data.id)) ?? '');
          setMessages(
            conversationResult.data.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              status: message.status,
              error: message.error,
              toolEvents: message.toolEvents,
            }))
          );
        });
      }
    });
  }, [conversationsLoaded, conversationId]);

  useEffect(() => {
    window.api.app.onUpdateAvailable((version) => {
      toast.info(`Update v${version} available, downloading...`);
    });

    window.api.app.onUpdateDownloaded((version) => {
      toast.success(`Update v${version} ready!`, {
        duration: Infinity,
        action: {
          label: 'Restart Now',
          onClick: () => window.api.app.quitAndInstall(),
        },
      });
    });

    return () => {
      window.api.app.removeUpdateListeners();
    };
  }, []);

  useEffect(() => {
    window.api.chat.onDelta((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      setStatusText('Streaming');
      setMessages((current) =>
        current.map((message) =>
          message.id === streamingMessageIdRef.current
            ? {
                ...message,
                content: message.content + event.textDelta,
                status: 'streaming',
              }
            : message
        )
      );
    });

    window.api.chat.onDone((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === streamingMessageIdRef.current
            ? {
                ...message,
                status: message.status === 'cancelled' ? 'cancelled' : 'completed',
              }
            : message
        )
      );
      setStatusText(event.finishReason ? `Finished: ${event.finishReason}` : 'Finished');
      activeRequestIdRef.current = null;
      streamingMessageIdRef.current = null;
      setActiveRequestId(null);
    });

    window.api.chat.onError((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === streamingMessageIdRef.current
            ? {
                ...message,
                status: event.error.code === 'chat.aborted' ? 'cancelled' : 'failed',
                error: event.error.message,
              }
            : message
        )
      );
      setStatusText(event.error.code === 'chat.aborted' ? 'Stopped' : 'Failed');
      if (event.error.code !== 'chat.aborted') {
        toast.error(event.error.message);
      }
      activeRequestIdRef.current = null;
      streamingMessageIdRef.current = null;
      setActiveRequestId(null);
    });

    window.api.chat.onToolCallStart((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      setStatusText('Using tool');
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== streamingMessageIdRef.current) {
            return message;
          }
          const existingEvents = message.toolEvents ?? [];
          const nextEvent: ToolEvent = {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            status: 'running',
            inputPreview: event.inputPreview,
          };
          return {
            ...message,
            toolEvents: existingEvents.some((item) => item.toolCallId === event.toolCallId)
              ? existingEvents.map((item) =>
                  item.toolCallId === event.toolCallId
                    ? {
                        ...item,
                        status: 'running',
                        inputPreview: event.inputPreview,
                      }
                    : item
                )
              : [...existingEvents, nextEvent],
          };
        })
      );
    });

    window.api.chat.onToolCallResult((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      setStatusText(event.status === 'completed' ? 'Tool completed' : 'Tool failed');
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== streamingMessageIdRef.current) {
            return message;
          }
          return {
            ...message,
            toolEvents: (message.toolEvents ?? []).map((item) =>
              item.toolCallId === event.toolCallId
                ? {
                    ...item,
                    status: event.status,
                    outputPreview: event.outputPreview,
                    errorMessage: event.errorMessage,
                    elapsedMs: event.elapsedMs,
                  }
                : item
            ),
          };
        })
      );
    });

    window.api.chat.onToolCallConfirmationRequired((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      setStatusText('Waiting approval');
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== streamingMessageIdRef.current) {
            return message;
          }
          const existingEvents = message.toolEvents ?? [];
          const nextEvent: ToolEvent = {
            action: event.action,
            approvalId: event.approvalId,
            inputPreview: event.inputPreview,
            riskSummary: event.riskSummary,
            status: 'pending_confirmation',
            targetPreview: event.targetPreview,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
          };
          return {
            ...message,
            toolEvents: [...existingEvents.filter((item) => item.toolCallId !== event.toolCallId), nextEvent],
          };
        })
      );
    });

    return () => {
      window.api.chat.removeStreamListeners();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(getDraftKey(conversationId), input);
  }, [conversationId, input]);

  function runSlashCommand(command: string): boolean {
    const [name, ...rest] = command.trim().split(/\s+/);
    const argument = rest.join(' ').trim();
    if (name === '/new' || name === '/clear') {
      const currentDraftKey = getDraftKey(conversationId);
      startNewConversation();
      localStorage.removeItem(currentDraftKey);
      setInput('');
      return true;
    }
    if (name === '/settings' || name === '/auth') {
      setShowSettings(true);
      setInput('');
      return true;
    }
    if (name === '/search') {
      setConversationSearch(argument);
      setInput('');
      window.setTimeout(() => conversationSearchRef.current?.focus(), 0);
      return true;
    }
    return false;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    if (trimmed.startsWith('/') && runSlashCommand(trimmed)) {
      return;
    }
    if (secureStatus?.siliconflowApiKeyConfigured === false) {
      toast.error('请先在设置面板保存 SiliconFlow API Key');
      setShowSettings(true);
      return;
    }

    const requestId = createId('request');
    const userMessage: ChatMessage = {
      id: createId('user'),
      role: 'user',
      content: trimmed,
      status: 'completed',
    };
    const assistantMessage: ChatMessage = {
      id: createId('assistant'),
      role: 'assistant',
      content: '',
      status: 'streaming',
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setInput('');
    localStorage.removeItem(getDraftKey(conversationId));
    activeRequestIdRef.current = requestId;
    streamingMessageIdRef.current = assistantMessage.id;
    setActiveRequestId(requestId);
    setStatusText('Connecting');

    const result = await window.api.chat.send({
      assistantMessageId: assistantMessage.id,
      conversationId: conversationId ?? undefined,
      requestId,
      messages: getMessagesForModel(nextMessages.filter((message) => message.id !== assistantMessage.id)),
      userMessage: {
        id: userMessage.id,
        content: userMessage.content,
      },
    });

    if (result.success && result.data) {
      setConversationId(result.data.conversationId);
      void refreshConversations(result.data.conversationId);
    } else {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                status: 'failed',
                error: result.error?.message ?? 'Failed to start chat request',
              }
            : message
        )
      );
      setStatusText('Failed');
      activeRequestIdRef.current = null;
      streamingMessageIdRef.current = null;
      setActiveRequestId(null);
      toast.error(result.error?.message ?? 'Failed to start chat request');
    }
  }

  async function stopGeneration() {
    if (!activeRequestId) {
      return;
    }
    const requestId = activeRequestId;
    const messageId = streamingMessageIdRef.current;
    setStatusText('Stopping');
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              status: 'cancelled',
            }
          : message
      )
    );
    await window.api.chat.stop(requestId);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function retryLastUserMessage() {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (lastUserMessage) {
      void sendMessage(lastUserMessage.content);
    }
  }

  async function copyMessage(content: string) {
    await navigator.clipboard.writeText(content);
    toast.success('Copied');
  }

  async function approveToolCall(approvalId: string) {
    const result = await window.api.chat.approveToolCall(approvalId);
    if (!result.success) {
      toast.error(result.error?.message ?? 'Failed to approve tool call');
    }
  }

  async function rejectToolCall(approvalId: string) {
    const result = await window.api.chat.rejectToolCall(approvalId, '用户取消执行');
    if (!result.success) {
      toast.error(result.error?.message ?? 'Failed to reject tool call');
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">
            <Bot size={20} />
            <div>
              <h1 className="app-title">Pexar Lark Agent</h1>
              <p className="app-subtitle">SiliconFlow Kimi-K2.6</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <span className={`chat-status ${isStreaming ? 'is-active' : ''}`}>{statusText}</span>
          <button onClick={() => setShowSettings(true)} className="settings-button" type="button">
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <main className="chat-shell">
        <aside className="conversation-sidebar" aria-label="Conversation history">
          <div className="conversation-sidebar-header">
            <span>会话</span>
            <button type="button" onClick={startNewConversation} disabled={isStreaming}>
              新建
            </button>
          </div>
          <div className="sidebar-search">
            <Search size={14} />
            <input
              ref={conversationSearchRef}
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="搜索会话"
              aria-label="搜索会话"
            />
          </div>
          <div className="sidebar-status-panel">
            <button type="button" className="sidebar-status-title" onClick={() => setShowSettings(true)}>
              <span>配置状态</span>
              <Settings size={14} />
            </button>
            {configItems.map((item) => (
              <div key={item.label} className={`sidebar-status-item ${item.ok ? 'is-ok' : 'is-missing'}`}>
                {item.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{item.label}</span>
              </div>
            ))}
            <div className={`sidebar-status-item ${hasPendingApproval ? 'is-waiting' : isStreaming ? 'is-running' : 'is-ok'}`}>
              <span className="status-dot" />
              <span>{hasPendingApproval ? '等待确认' : isStreaming ? '正在执行' : '空闲'}</span>
            </div>
          </div>
          <div className="conversation-list">
            {conversations.length === 0 ? (
              <p className="conversation-empty">暂无历史会话</p>
            ) : filteredConversationGroups.length === 0 ? (
              <p className="conversation-empty">没有匹配的会话</p>
            ) : (
              filteredConversationGroups.map((group) => (
                <section key={group.label} className="conversation-group">
                  <h3>{group.label}</h3>
                  {group.conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`conversation-item ${conversation.id === conversationId ? 'is-active' : ''}`}
                    >
                      <button type="button" onClick={() => void loadConversation(conversation.id)}>
                        <span className="conversation-title">{conversation.title}</span>
                        {conversation.lastMessagePreview ? (
                          <span className="conversation-preview">{conversation.lastMessagePreview}</span>
                        ) : null}
                        <span className="conversation-time">
                          {formatConversationTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="conversation-delete"
                        onClick={() => void deleteConversation(conversation.id)}
                        title="删除会话"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        </aside>

        <section className="chat-thread" aria-label="Chat messages">
          {secureStatus?.siliconflowApiKeyConfigured === false ? (
            <div className="config-warning">
              <div>
                <strong>缺少 SiliconFlow API Key</strong>
                <span>请在设置面板保存后再开始聊天。</span>
              </div>
              <button type="button" className="primary-button" onClick={() => setShowSettings(true)}>
                打开设置
              </button>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                <Bot size={28} />
              </div>
              <h2>今天要处理什么飞书任务？</h2>
              <p>可以创建文档、查询群消息、搜索云文档或发送消息。</p>
              <div className="suggested-grid">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={isStreaming}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article key={message.id} className={`chat-message is-${message.role}`}>
                  <div className="message-avatar" aria-hidden="true">
                    {message.role === 'user' ? <UserRound size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
                      {message.status && message.role === 'assistant' ? (
                        <span className={`message-state is-${message.status}`}>{message.status}</span>
                      ) : null}
                    </div>
                    <div className="message-content">
                      {message.role === 'assistant' && message.toolEvents ? (
                        <ToolEventList
                          events={message.toolEvents}
                          onApprove={(approvalId) => void approveToolCall(approvalId)}
                          onReject={(approvalId) => void rejectToolCall(approvalId)}
                        />
                      ) : null}
                      {message.content && message.role === 'assistant' ? (
                        <Streamdown className="markdown-content" mode="streaming" controls={false}>
                          {message.content}
                        </Streamdown>
                      ) : message.content ? (
                        <p>{message.content}</p>
                      ) : (
                        <p className="message-placeholder">Connecting to model...</p>
                      )}
                      {message.error ? <p className="message-error">{message.error}</p> : null}
                    </div>
                    {message.role === 'assistant' && message.content ? (
                      <div className="message-actions">
                        <button type="button" onClick={() => void copyMessage(message.content)} title="Copy">
                          <Copy size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            rows={1}
            disabled={isStreaming}
          />
          <div className="composer-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={retryLastUserMessage}
              disabled={isStreaming || modelMessages.length === 0}
              title="Retry last prompt"
            >
              <RotateCcw size={16} />
            </button>
            {isStreaming ? (
              <button type="button" className="stop-button" onClick={() => void stopGeneration()}>
                <Square size={15} />
                <span>Stop</span>
              </button>
            ) : (
              <button type="submit" className="primary-button" disabled={!canSend}>
                <Send size={15} />
                <span>Send</span>
              </button>
            )}
          </div>
        </form>
      </main>

      <footer className="app-footer">Version {appVersion || '-'}</footer>

      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            window.api.secureSettings.getStatus().then((result) => {
              if (result.success && result.data) {
                setSecureStatus(result.data);
              }
            });
          }}
        />
      )}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
