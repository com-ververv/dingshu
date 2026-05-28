/**
 * Pexar Lark Agent - Chatbot UI
 */

import React, { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Box,
  CheckCircle2,
  Clock,
  Copy,
  Crosshair,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Info,
  Laptop,
  LayoutPanelLeft,
  Monitor,
  Plus,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Plug,
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
import type { ChatConversationSummary, LarkObjectSearchResult, LarkObjectType, SecureSettingsStatus } from '../types/window';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: number;
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

type Artifact = {
  contentPreview?: string;
  errorMessage?: string;
  id: string;
  status: 'draft' | 'creating' | 'created' | 'failed' | 'cancelled';
  title: string;
  token?: string;
  url?: string;
};

type GitDiffStats = {
  additions: number;
  deletions: number;
};

type MentionQuery = {
  end: number;
  query: string;
  start: number;
};

const suggestedPrompts = [
  '把这段内容创建为飞书文档',
  '总结一下「研发群」今天的讨论',
  '找一下上周的评估报告',
  '给某人发送一条飞书消息',
];

const DRAFT_PREFIX = 'pexar-lark-agent:draft:';

const LARK_OBJECT_TYPE_LABELS: Record<LarkObjectType, string> = {
  chat: '群',
  contact: '联系人',
  document: '文档',
};

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

function getStatusLabel(status: ToolEvent['status']): string {
  if (status === 'pending_confirmation') {
    return '等待确认';
  }
  if (status === 'running') {
    return '正在执行';
  }
  if (status === 'completed') {
    return '已完成';
  }
  if (status === 'cancelled') {
    return '已拒绝';
  }
  return '执行失败';
}

function getMessageStatusLabel(status: ChatMessage['status']): string {
  if (status === 'streaming') {
    return '正在生成';
  }
  if (status === 'completed') {
    return '已完成';
  }
  if (status === 'cancelled') {
    return '已停止';
  }
  if (status === 'failed') {
    return '失败';
  }
  return '';
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

function formatConversationPreview(preview?: string): string {
  if (!preview) {
    return '';
  }
  const normalized = preview
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*$/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/-{2,}/g, ' ')
    .replace(/[|*_~>#]+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > 86 ? `${normalized.slice(0, 86).trimEnd()}...` : normalized;
}

function formatMessageTime(timestamp?: number): string {
  if (!timestamp) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function getConfigItems(status: SecureSettingsStatus | null) {
  const larkAppReady = status?.larkAppIdHealthy === true && status?.larkAppSecretHealthy === true;
  return [
    {
      label: '模型',
      detail:
        status?.siliconflowApiKeyConfigured === true && status?.siliconflowApiKeyHealthy === false
          ? '需重新保存'
          : undefined,
      ok: status?.siliconflowApiKeyHealthy === true,
    },
    {
      label: '飞书应用',
      detail:
        (status?.larkAppIdConfigured === true && status?.larkAppIdHealthy === false) ||
        (status?.larkAppSecretConfigured === true && status?.larkAppSecretHealthy === false)
          ? '需重新保存'
          : undefined,
      ok: larkAppReady,
    },
    {
      label: '飞书授权',
      detail: status?.larkAuth.configured === true && !larkAppReady ? '缺少应用凭证' : undefined,
      ok: status?.larkAuth.configured === true && larkAppReady,
    },
  ];
}

function getDraftKey(conversationId: string | null): string {
  return `${DRAFT_PREFIX}${conversationId ?? 'new'}`;
}

function parsePreviewJson(value?: string): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getExternalLinkFromClick(event: MouseEvent<HTMLElement>): string | undefined {
  const link = (event.target as HTMLElement).closest('a[href]');
  const href = link?.getAttribute('href')?.trim();
  return href && /^https?:\/\//i.test(href) ? href : undefined;
}

function normalizeLoadedMessage(message: ChatMessage): ChatMessage {
  const status = message.role === 'assistant' && message.status === 'streaming' ? 'cancelled' : message.status;
  const error =
    message.role === 'assistant' && message.status === 'streaming'
      ? message.error ?? '上次生成已中断，可点击下方按钮重新发送上一条。'
      : message.error;

  return {
    ...message,
    status,
    error,
    toolEvents: message.toolEvents?.map((event) =>
      event.status === 'pending_confirmation' || event.status === 'running'
        ? {
            ...event,
            status: 'cancelled',
            errorMessage: event.errorMessage ?? '上次会话已中断，请重新发起。',
          }
        : event
    ),
  };
}

function deriveArtifacts(messages: ChatMessage[]): Artifact[] {
  const artifacts = new Map<string, Artifact>();
  for (const message of messages) {
    for (const event of message.toolEvents ?? []) {
      if (event.toolName !== 'lark_doc_create') {
        continue;
      }
      const input = parsePreviewJson(event.inputPreview);
      const output = parsePreviewJson(event.outputPreview);
      const existing = artifacts.get(event.toolCallId);
      const title = getString(output.title) ?? getString(input.title) ?? existing?.title ?? '未命名文档';
      const contentPreview = getString(input.contentPreview) ?? existing?.contentPreview;
      const url = getString(output.url) ?? existing?.url;
      const token = getString(output.token) ?? existing?.token;
      const status: Artifact['status'] =
        event.status === 'completed' && url
          ? 'created'
          : event.status === 'completed'
            ? 'creating'
            : event.status === 'pending_confirmation'
              ? 'draft'
              : event.status === 'running'
                ? 'creating'
                : event.status === 'cancelled'
                  ? 'cancelled'
                  : event.status === 'failed'
                    ? 'failed'
                    : 'draft';
      artifacts.set(event.toolCallId, {
        contentPreview,
        errorMessage: event.errorMessage,
        id: event.toolCallId,
        status,
        title,
        token,
        url,
      });
    }
  }
  return [...artifacts.values()].reverse();
}

function findMentionQuery(value: string, cursor: number): MentionQuery | null {
  const beforeCursor = value.slice(0, cursor);
  const match = /(^|\s)@([^\s@（）()，,。]*)$/.exec(beforeCursor);
  if (!match) {
    return null;
  }
  const query = match[2] ?? '';
  return {
    end: cursor,
    query,
    start: beforeCursor.length - query.length - 1,
  };
}

function getArtifactStatusLabel(status: Artifact['status']): string {
  if (status === 'created') {
    return '已创建';
  }
  if (status === 'creating') {
    return '创建中';
  }
  if (status === 'failed') {
    return '失败';
  }
  if (status === 'cancelled') {
    return '未创建';
  }
  return '待确认';
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

  const summary = {
    failed: events.filter((event) => event.status === 'failed').length,
    pending: events.filter((event) => event.status === 'pending_confirmation').length,
    running: events.filter((event) => event.status === 'running').length,
    total: events.length,
  };

  return (
    <div className="tool-event-list">
      <div className="tool-event-summary">
        <span>{summary.total} 个动作</span>
        {summary.running > 0 ? <span>{summary.running} 正在执行</span> : null}
        {summary.pending > 0 ? <span>{summary.pending} 等待确认</span> : null}
        {summary.failed > 0 ? <span>{summary.failed} 失败</span> : null}
      </div>
      {events.map((event) => (
        <details
          key={event.toolCallId}
          className={`tool-event is-${event.status}`}
          open={event.status === 'pending_confirmation'}
        >
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
            <span className="tool-event-status">{getStatusLabel(event.status)}</span>
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
                  仅本次允许
                </button>
                <button type="button" className="secondary-text-button" onClick={() => onReject(event.approvalId!)}>
                  拒绝
                </button>
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function ArtifactPanel({
  artifacts,
  collapsed,
  gitDiffStats,
  onCopy,
  onLinkClick,
  onOpen,
  onToggle,
}: {
  artifacts: Artifact[];
  collapsed: boolean;
  gitDiffStats: GitDiffStats;
  onCopy: (content: string, label: string) => void;
  onLinkClick: (event: MouseEvent<HTMLElement>) => void;
  onOpen: (url: string) => void;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="artifact-rail" aria-label="Artifact panel collapsed">
        <button type="button" onClick={onToggle} title="展开预览">
          <PanelRightOpen size={16} />
        </button>
      </aside>
    );
  }

  const activeArtifact = artifacts[0];
  const hasGitChanges = gitDiffStats.additions > 0 || gitDiffStats.deletions > 0;

  return (
    <aside className="artifact-panel" aria-label="Document artifact preview">
      <section className="codex-side-card">
        <div className="codex-card-header">
          <h2>Environment</h2>
          <button type="button" onClick={onToggle} title="收起预览">
            <Settings size={16} />
          </button>
        </div>
        <div className="environment-list">
          <div className="environment-item environment-changes">
            <FileText size={14} />
            <span>Changes</span>
            <small className="change-addition">+{gitDiffStats.additions.toLocaleString()}</small>
            <small className="change-deletion">-{gitDiffStats.deletions.toLocaleString()}</small>
          </div>
          <div className="environment-item">
            <Laptop size={14} />
            <span>Local</span>
          </div>
          <div className="environment-item">
            <GitBranch size={14} />
            <span>codex/siliconflow-ai-sdk-demo</span>
          </div>
          <div className="environment-item">
            {hasGitChanges ? <GitCommitHorizontal size={14} /> : <ExternalLink size={14} />}
            <span>{hasGitChanges ? 'Commit' : 'Push'}</span>
          </div>
          <div className="environment-item">
            <Github size={14} />
            <span>Create pull request</span>
          </div>
        </div>
        <div className="side-card-divider" />
        <div className="codex-card-section-title">Sources</div>
        <div className="environment-item">
          <Info size={14} />
          <span>No sources yet</span>
        </div>
      </section>

      {!activeArtifact ? (
        <div className="artifact-empty">
          <FileText size={22} />
          <p>创建飞书文档时，这里会显示待确认内容和创建结果。</p>
        </div>
      ) : (
        <div className="artifact-stack">
          {artifacts.map((artifact) => (
            <section key={artifact.id} className={`artifact-card is-${artifact.status}`}>
              <div className="artifact-card-header">
                <FileText size={16} />
                <div>
                  <h3>{artifact.title}</h3>
                  <span>{getArtifactStatusLabel(artifact.status)}</span>
                </div>
              </div>
              {artifact.contentPreview ? (
                <div className="artifact-preview" onClick={onLinkClick}>
                  <Streamdown className="markdown-content" mode="streaming" controls={false} linkSafety={{ enabled: false }}>
                    {artifact.contentPreview}
                  </Streamdown>
                </div>
              ) : (
                <p className="artifact-muted">暂无正文预览</p>
              )}
              {artifact.errorMessage ? <p className="artifact-error">{artifact.errorMessage}</p> : null}
              <div className="artifact-actions">
                {artifact.contentPreview ? (
                  <button type="button" onClick={() => onCopy(artifact.contentPreview!, '正文已复制')}>
                    <Copy size={14} />
                    <span>正文</span>
                  </button>
                ) : null}
                {artifact.url ? (
                  <>
                    <button type="button" onClick={() => onCopy(artifact.url!, '链接已复制')}>
                      <Copy size={14} />
                      <span>链接</span>
                    </button>
                    <button type="button" onClick={() => onOpen(artifact.url!)}>
                      <ExternalLink size={14} />
                      <span>打开</span>
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}

function MentionPicker({
  error,
  loading,
  onSelect,
  query,
  results,
}: {
  error?: string;
  loading: boolean;
  onSelect: (item: LarkObjectSearchResult) => void;
  query: string;
  results: LarkObjectSearchResult[];
}) {
  const grouped = new Map<LarkObjectType, LarkObjectSearchResult[]>();
  for (const result of results) {
    grouped.set(result.type, [...(grouped.get(result.type) ?? []), result]);
  }

  return (
    <div className="mention-picker">
      <div className="mention-picker-header">
        <Search size={13} />
        <span>{query ? `搜索「${query}」` : '输入名称搜索飞书对象'}</span>
      </div>
      {loading ? <p className="mention-picker-state">正在搜索...</p> : null}
      {!loading && error ? <p className="mention-picker-state is-error">{error}</p> : null}
      {!loading && !error && results.length === 0 ? <p className="mention-picker-state">没有匹配结果</p> : null}
      {!loading && !error
        ? (['chat', 'contact', 'document'] as LarkObjectType[]).map((type) => {
            const items = grouped.get(type) ?? [];
            if (items.length === 0) {
              return null;
            }
            return (
              <section key={type} className="mention-picker-group">
                <h4>{LARK_OBJECT_TYPE_LABELS[type]}</h4>
                {items.map((item) => (
                  <button key={`${item.type}:${item.id}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)}>
                    <span className="mention-icon">
                      {item.type === 'chat' ? <MessageSquare size={14} /> : item.type === 'document' ? <FileText size={14} /> : <UserRound size={14} />}
                    </span>
                    <span className="mention-main">
                      <strong>{item.title}</strong>
                      {item.subtitle ? <small>{item.subtitle}</small> : null}
                    </span>
                  </button>
                ))}
              </section>
            );
          })
        : null}
    </div>
  );
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [secureStatus, setSecureStatus] = useState<SecureSettingsStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const [artifactCollapsed, setArtifactCollapsed] = useState(false);
  const [gitDiffStats, setGitDiffStats] = useState<GitDiffStats>({ additions: 0, deletions: 0 });
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [mentionResults, setMentionResults] = useState<LarkObjectSearchResult[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionError, setMentionError] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationSearchRef = useRef<HTMLInputElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const mentionRequestRef = useRef(0);
  const scrollHideTimerRef = useRef<number | null>(null);

  const isStreaming = activeRequestId !== null;
  const canSend = input.trim().length > 0 && !isStreaming && secureStatus?.siliconflowApiKeyHealthy !== false;

  const modelMessages = useMemo(() => getMessagesForModel(messages), [messages]);
  const filteredConversationGroups = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();
    const filtered = keyword
      ? conversations.filter((conversation) =>
          `${conversation.title} ${conversation.lastMessagePreview ?? ''}`.toLowerCase().includes(keyword) ||
          conversation.id === conversationId
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
  }, [conversationId, conversationSearch, conversations]);
  const configItems = useMemo(() => getConfigItems(secureStatus), [secureStatus]);
  const hasPendingApproval = messages.some((message) =>
    message.toolEvents?.some((event) => event.status === 'pending_confirmation')
  );
  const artifacts = useMemo(() => deriveArtifacts(messages), [messages]);
  const activeConversationTitle =
    conversations.find((conversation) => conversation.id === conversationId)?.title ?? 'New chat';

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
        createdAt: message.createdAt,
        status: message.status,
        error: message.error,
        toolEvents: message.toolEvents,
      })).map(normalizeLoadedMessage)
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

  function beginRenameConversation(conversation: ChatConversationSummary) {
    setRenamingConversationId(conversation.id);
    setRenamingTitle(conversation.title);
  }

  function cancelRenameConversation() {
    setRenamingConversationId(null);
    setRenamingTitle('');
  }

  async function saveConversationRename(targetConversationId: string) {
    const title = renamingTitle.trim();
    if (!title) {
      toast.error('会话名称不能为空');
      return;
    }
    const result = await window.api.chat.renameConversation(targetConversationId, title);
    if (!result.success || !result.data) {
      toast.error(result.error?.message ?? '重命名失败');
      return;
    }
    setConversations((current) =>
      current.map((conversation) => (conversation.id === targetConversationId ? result.data! : conversation))
    );
    if (targetConversationId === conversationId) {
      const keyword = conversationSearch.trim().toLowerCase();
      const searchable = `${result.data.title} ${result.data.lastMessagePreview ?? ''}`.toLowerCase();
      if (keyword && !searchable.includes(keyword)) {
        setConversationSearch('');
      }
    }
    cancelRenameConversation();
    await refreshConversations(conversationId ?? undefined);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, targetConversationId: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveConversationRename(targetConversationId);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelRenameConversation();
    }
  }

  useEffect(() => {
    window.api.secureSettings.getStatus().then((result) => {
      if (result.success && result.data) {
        setSecureStatus(result.data);
      }
    });
    window.api.app.getGitDiffStats().then((result) => {
      if (result.success && result.data) {
        setGitDiffStats(result.data);
      }
    });
  }, []);

  useEffect(() => {
    function showScrollbarsWhileScrolling() {
      document.body.classList.add('is-scrolling');
      if (scrollHideTimerRef.current !== null) {
        window.clearTimeout(scrollHideTimerRef.current);
      }
      scrollHideTimerRef.current = window.setTimeout(() => {
        document.body.classList.remove('is-scrolling');
        scrollHideTimerRef.current = null;
      }, 800);
    }

    window.addEventListener('scroll', showScrollbarsWhileScrolling, true);
    return () => {
      window.removeEventListener('scroll', showScrollbarsWhileScrolling, true);
      if (scrollHideTimerRef.current !== null) {
        window.clearTimeout(scrollHideTimerRef.current);
      }
      document.body.classList.remove('is-scrolling');
    };
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
              createdAt: message.createdAt,
              status: message.status,
              error: message.error,
              toolEvents: message.toolEvents,
            })).map(normalizeLoadedMessage)
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
      const messageId = streamingMessageIdRef.current;
      setStatusText('正在生成');
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
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
      const messageId = streamingMessageIdRef.current;
      const wasCancelled = event.finishReason === 'cancelled';
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                status: wasCancelled || message.status === 'cancelled' ? 'cancelled' : 'completed',
              }
            : message
        )
      );
      setStatusText(wasCancelled ? '已停止' : '已完成');
      activeRequestIdRef.current = null;
      streamingMessageIdRef.current = null;
      setActiveRequestId(null);
    });

    window.api.chat.onError((event) => {
      if (event.requestId !== activeRequestIdRef.current) {
        return;
      }
      const messageId = streamingMessageIdRef.current;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                status: event.error.code === 'chat.aborted' ? 'cancelled' : 'failed',
                error: event.error.message,
              }
            : message
        )
      );
      setStatusText(event.error.code === 'chat.aborted' ? '已停止' : '失败');
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
      const messageId = streamingMessageIdRef.current;
      setStatusText('正在调用飞书');
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) {
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
      const messageId = streamingMessageIdRef.current;
      setStatusText(event.status === 'completed' ? '飞书调用完成' : '飞书调用失败');
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) {
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
      const messageId = streamingMessageIdRef.current;
      setStatusText('等待确认');
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) {
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
    if (!activeRequestId) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (activeRequestIdRef.current) {
        setStatusText('执行时间较长，仍在等待返回');
      }
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [activeRequestId]);

  useEffect(() => {
    localStorage.setItem(getDraftKey(conversationId), input);
  }, [conversationId, input]);

  useEffect(() => {
    if (!mentionQuery) {
      return;
    }
    if (!mentionQuery.query.trim()) {
      return;
    }

    const requestId = mentionRequestRef.current + 1;
    mentionRequestRef.current = requestId;
    const timer = window.setTimeout(() => {
      window.api.larkObject
        .search({ query: mentionQuery.query, limit: 4 })
        .then((result) => {
          if (mentionRequestRef.current !== requestId) {
            return;
          }
          if (!result.success) {
            setMentionError(result.error?.message ?? '搜索飞书对象失败');
            setMentionResults([]);
            return;
          }
          setMentionResults(result.data ?? []);
        })
        .catch((error: unknown) => {
          if (mentionRequestRef.current !== requestId) {
            return;
          }
          setMentionError(error instanceof Error ? error.message : String(error));
          setMentionResults([]);
        })
        .finally(() => {
          if (mentionRequestRef.current === requestId) {
            setMentionLoading(false);
          }
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mentionQuery]);

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
    if (secureStatus?.siliconflowApiKeyHealthy === false) {
      const message =
        secureStatus.siliconflowApiKeyConfigured === true
          ? '已保存的 SiliconFlow API Key 无法解密，请重新保存'
          : '请先在设置面板保存 SiliconFlow API Key';
      toast.error(message);
      setShowSettings(true);
      return;
    }

    const requestId = createId('request');
    const messageCreatedAt = Number(requestId.split('_')[1]) || undefined;
    const userMessage: ChatMessage = {
      id: createId('user'),
      role: 'user',
      content: trimmed,
      createdAt: messageCreatedAt,
      status: 'completed',
    };
    const assistantMessage: ChatMessage = {
      id: createId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: messageCreatedAt,
      status: 'streaming',
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setInput('');
    localStorage.removeItem(getDraftKey(conversationId));
    activeRequestIdRef.current = requestId;
    streamingMessageIdRef.current = assistantMessage.id;
    setActiveRequestId(requestId);
    setStatusText('正在连接');

    let result;
    try {
      result = await window.api.chat.send({
        assistantMessageId: assistantMessage.id,
        conversationId: conversationId ?? undefined,
        requestId,
        messages: getMessagesForModel(nextMessages.filter((message) => message.id !== assistantMessage.id)),
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
        },
      });
    } catch (error) {
      result = {
        success: false,
        error: {
          code: 'CHAT_SEND_IPC_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

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
      setStatusText('失败');
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
    setStatusText('正在停止');
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
    if (event.key === 'Escape' && mentionQuery) {
      event.preventDefault();
      setMentionQuery(null);
    }
  }

  function handleInputChange(value: string, cursor: number) {
    const nextQuery = findMentionQuery(value, cursor);
    setInput(value);
    setMentionQuery(nextQuery);
    if (nextQuery?.query.trim()) {
      setMentionLoading(true);
      setMentionError(undefined);
    } else {
      setMentionResults([]);
      setMentionLoading(false);
      setMentionError(undefined);
    }
  }

  function insertMention(item: LarkObjectSearchResult) {
    const query = mentionQuery;
    if (!query) {
      return;
    }
    const before = input.slice(0, query.start);
    const after = input.slice(query.end);
    const nextInput = `${before}${item.reference} ${after}`;
    const nextCursor = before.length + item.reference.length + 1;
    setInput(nextInput);
    setMentionQuery(null);
    setMentionResults([]);
    setMentionLoading(false);
    setMentionError(undefined);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }

  function retryLastUserMessage() {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (lastUserMessage) {
      void sendMessage(lastUserMessage.content);
    }
  }

  async function copyMessage(content: string) {
    await navigator.clipboard.writeText(content);
    toast.success('已复制');
  }

  async function copyText(content: string, label: string) {
    await navigator.clipboard.writeText(content);
    toast.success(label);
  }

  function openExternal(url: string) {
    void window.api.shell.openExternal(url);
  }

  function openMarkdownLink(event: MouseEvent<HTMLElement>) {
    const href = getExternalLinkFromClick(event);
    if (!href) {
      return;
    }
    event.preventDefault();
    openExternal(href);
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
          <h1 className="app-title">{activeConversationTitle}</h1>
          <button type="button" className="header-more-button" aria-label="更多">
            ...
          </button>
        </div>
        <div className="header-right">
          <span className={`chat-status ${isStreaming ? 'is-active' : ''}`} data-testid="chat-status">
            {statusText}
          </span>
          <div className="header-tool-group" aria-label="Workspace tools">
            <button type="button" className="header-tool-button" aria-label="编辑器">
              <Monitor size={15} />
            </button>
            <button type="button" className="header-tool-button" aria-label="信息">
              <Info size={15} />
            </button>
            <button type="button" className="header-tool-button" aria-label="布局">
              <LayoutPanelLeft size={15} />
            </button>
          </div>
          <button onClick={() => setShowSettings(true)} className="settings-button" type="button">
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <main className={`chat-shell ${messages.length === 0 ? 'is-empty' : 'has-messages'}`}>
        <aside className="conversation-sidebar" aria-label="Conversation history">
          <div className="sidebar-window-spacer" aria-hidden="true">
            <PanelRightClose size={15} />
            <span>
              ‹
            </span>
            <span>
              ›
            </span>
          </div>
          <nav className="sidebar-primary-nav" aria-label="Primary navigation">
            <button type="button" onClick={startNewConversation} disabled={isStreaming}>
              <PenLine size={16} />
              <span>New chat</span>
            </button>
            <button type="button" onClick={() => conversationSearchRef.current?.focus()}>
              <Search size={16} />
              <span>Search</span>
            </button>
            <button type="button" onClick={() => setShowSettings(true)}>
              <Box size={16} />
              <span>Skills</span>
            </button>
            <button type="button" disabled>
              <Plug size={16} />
              <span>Plugins</span>
            </button>
            <button type="button" disabled>
              <Clock size={16} />
              <span>Automations</span>
            </button>
          </nav>
          <div className="sidebar-section-label">Pinned</div>
          <div className="sidebar-pinned-entry">
            <Folder size={16} />
            <span>code</span>
          </div>
          <div className="sidebar-section-label">Projects</div>
          <div className="sidebar-project-title">
            <Folder size={16} />
            <span>desktop-starter-app</span>
          </div>
          <div className="conversation-sidebar-header">
            <span>Chats</span>
            <button
              type="button"
              onClick={startNewConversation}
              disabled={isStreaming}
              aria-label="新建会话"
              data-testid="new-conversation-button"
            >
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
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            ))}
            <div className={`sidebar-status-item ${hasPendingApproval ? 'is-waiting' : isStreaming ? 'is-running' : 'is-ok'}`}>
              <span className="status-dot" />
              <span>{hasPendingApproval ? '等待确认' : isStreaming ? '正在执行' : '空闲'}</span>
            </div>
          </div>
          <div className="conversation-list">
            {conversations.length === 0 ? (
              <p className="conversation-empty" data-testid="conversation-empty">
                暂无历史会话
              </p>
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
                      {renamingConversationId === conversation.id ? (
                        <input
                          className="conversation-rename-input"
                          value={renamingTitle}
                          autoFocus
                          maxLength={80}
                          onBlur={() => void saveConversationRename(conversation.id)}
                          onChange={(event) => setRenamingTitle(event.target.value)}
                          onKeyDown={(event) => handleRenameKeyDown(event, conversation.id)}
                          aria-label="重命名会话"
                        />
                      ) : (
                        <button type="button" onClick={() => void loadConversation(conversation.id)}>
                          <span className="conversation-title">{conversation.title}</span>
                          {formatConversationPreview(conversation.lastMessagePreview) ? (
                            <span className="conversation-preview">
                              {formatConversationPreview(conversation.lastMessagePreview)}
                            </span>
                          ) : null}
                          <span className="conversation-time">
                            {formatConversationTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="conversation-rename"
                        onClick={() => beginRenameConversation(conversation)}
                        title="重命名会话"
                      >
                        <Edit3 size={13} />
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
          <button type="button" className="sidebar-settings-entry" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </aside>

        <section className="chat-thread" aria-label="Chat messages" data-testid="chat-thread">
          {secureStatus?.siliconflowApiKeyHealthy === false ? (
            <div className="config-warning">
              <div>
                <strong>
                  {secureStatus.siliconflowApiKeyConfigured ? 'SiliconFlow API Key 无法读取' : '缺少 SiliconFlow API Key'}
                </strong>
                <span>{secureStatus.siliconflowApiKeyConfigured ? '请重新保存 API Key 后再开始聊天。' : '请在设置面板保存后再开始聊天。'}</span>
              </div>
              <button type="button" className="primary-button" onClick={() => setShowSettings(true)}>
                打开设置
              </button>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="chat-empty" data-testid="chat-empty-state">
              <h2>What should we build?</h2>
              <p>Pexar Lark Agent</p>
              <div className="suggested-grid">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={isStreaming}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list" data-testid="message-list">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`chat-message is-${message.role}`}
                  data-testid={`chat-message-${message.role}`}
                >
                  <div className="message-avatar" aria-hidden="true">
                    {message.role === 'user' ? <UserRound size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="message-body">
                    {message.role === 'assistant' ? (
                      <div className="message-meta">
                        <span>Assistant</span>
                        {message.status ? (
                          <span className={`message-state is-${message.status}`}>{getMessageStatusLabel(message.status)}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="message-content" onClick={openMarkdownLink}>
                      {message.role === 'assistant' && message.toolEvents ? (
                        <ToolEventList
                          events={message.toolEvents}
                          onApprove={(approvalId) => void approveToolCall(approvalId)}
                          onReject={(approvalId) => void rejectToolCall(approvalId)}
                        />
                      ) : null}
                      {message.content && message.role === 'assistant' ? (
                        <Streamdown className="markdown-content" mode="streaming" controls={false} linkSafety={{ enabled: false }}>
                          {message.content}
                        </Streamdown>
                      ) : message.content ? (
                        <p>{message.content}</p>
                      ) : (
                        <p className="message-placeholder">正在连接模型...</p>
                      )}
                      {message.error ? <p className="message-error">{message.error}</p> : null}
                    </div>
                    {message.content ? (
                      <div className="message-actions">
                        {message.role === 'user' ? <span>{formatMessageTime(message.createdAt)}</span> : null}
                        <button type="button" onClick={() => void copyMessage(message.content)} title="复制">
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
          <div className="composer-input-wrap">
            {mentionQuery ? (
              <MentionPicker
                error={mentionError}
                loading={mentionLoading}
                onSelect={insertMention}
                query={mentionQuery.query}
                results={mentionResults}
              />
            ) : null}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => handleInputChange(event.target.value, event.currentTarget.selectionStart)}
            onClick={(event) => setMentionQuery(findMentionQuery(input, event.currentTarget.selectionStart))}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，@ 选择飞书对象，Enter 发送"
            aria-label="消息输入框"
            data-testid="chat-input"
            rows={1}
            disabled={isStreaming}
          />
          </div>
          <div className="composer-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={retryLastUserMessage}
              disabled={isStreaming || modelMessages.length === 0}
              title="重新发送上一条"
            >
              <RotateCcw size={16} />
            </button>
            {isStreaming ? (
              <button type="button" className="stop-button" onClick={() => void stopGeneration()}>
                <Square size={15} />
                <span>停止</span>
              </button>
            ) : (
              <button
                type="submit"
                className="primary-button"
                disabled={!canSend}
                aria-label="发送消息"
                data-testid="send-message-button"
              >
                <Send size={15} />
                <span>发送</span>
              </button>
            )}
          </div>
          <div className="composer-status-row" aria-hidden="true">
            <span className="composer-plus"><Plus size={18} /></span>
            <span className="composer-access"><AlertCircle size={14} />Full access</span>
            <span className="composer-goal"><Crosshair size={14} />Goal</span>
            <span className="composer-model">Pexar</span>
            <span>5.5</span>
            <span>High</span>
          </div>
        </form>

        <ArtifactPanel
          artifacts={artifacts}
          collapsed={artifactCollapsed}
          gitDiffStats={gitDiffStats}
          onCopy={(content, label) => void copyText(content, label)}
          onLinkClick={openMarkdownLink}
          onOpen={openExternal}
          onToggle={() => setArtifactCollapsed((current) => !current)}
        />
      </main>

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
