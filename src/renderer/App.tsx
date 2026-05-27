/**
 * Pexar Lark Agent - Chatbot UI
 */

import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, Copy, RotateCcw, Search, Send, Settings, Square, UserRound, XCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { Settings as SettingsModal } from './components/Settings';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'completed' | 'cancelled' | 'failed';
  error?: string;
  toolEvents?: ToolEvent[];
};

type ToolEvent = {
  toolCallId: string;
  toolName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  inputPreview: string;
  outputPreview?: string;
  errorMessage?: string;
  elapsedMs?: number;
};

const suggestedPrompts = [
  '用一句话介绍你能帮我做什么',
  '搜索飞书里和测试相关的文档',
  '帮我把一段内容整理成飞书文档大纲',
  '总结今天研发群的重点讨论',
];

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
  if (toolName === 'lark_doc_search') {
    return '搜索飞书文档';
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

function ToolEventList({ events }: { events: ToolEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="tool-event-list">
      {events.map((event) => (
        <details key={event.toolCallId} className={`tool-event is-${event.status}`} open={event.status === 'running'}>
          <summary>
            <span className="tool-event-icon">
              {event.status === 'running' ? (
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
          </div>
        </details>
      ))}
    </div>
  );
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  const isStreaming = activeRequestId !== null;
  const canSend = input.trim().length > 0 && !isStreaming;

  const modelMessages = useMemo(() => getMessagesForModel(messages), [messages]);

  useEffect(() => {
    window.api.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setAppVersion(result.data);
      }
    });
  }, []);

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
            toolEvents: [...existingEvents.filter((item) => item.toolCallId !== event.toolCallId), nextEvent],
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

    return () => {
      window.api.chat.removeStreamListeners();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
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
    activeRequestIdRef.current = requestId;
    streamingMessageIdRef.current = assistantMessage.id;
    setActiveRequestId(requestId);
    setStatusText('Connecting');

    const result = await window.api.chat.send({
      requestId,
      messages: getMessagesForModel(nextMessages.filter((message) => message.id !== assistantMessage.id)),
    });

    if (!result.success) {
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
        <section className="chat-thread" aria-label="Chat messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                <Bot size={28} />
              </div>
              <h2>开始一个飞书助手对话</h2>
              <p>第一版已接入 Electron IPC 和 SiliconFlow 流式响应。先验证聊天体验，再接工具展示和持久化。</p>
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
                      {message.role === 'assistant' && message.toolEvents ? <ToolEventList events={message.toolEvents} /> : null}
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
