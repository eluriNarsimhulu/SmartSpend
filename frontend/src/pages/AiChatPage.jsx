// frontend/src/pages/AiChatPage.jsx
// SmartSpend AI – full ChatGPT-like chat page.

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import Icon from '../components/Icon';
import { aiService, sendMessageStream } from '../services/aiService';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const SUGGESTIONS = [
  'Analyze my spending this month.',
  'Where is most of my money going?',
  'Compare this month with last month.',
  'Show my top 5 expenses.',
  'How can I save more money?',
  'Explain the 50/30/20 budgeting rule.',
];

// ── Tiny markdown renderer (no external lib, XSS-safe via textContent) ────────
function renderMarkdown(text) {
  // Process line by line, building up HTML safely
  const lines = text.split('\n');
  const result = [];
  let inUl = false, inOl = false, inPre = false, preContent = '';

  const closeList = () => {
    if (inUl) { result.push('</ul>'); inUl = false; }
    if (inOl) { result.push('</ol>'); inOl = false; }
  };

  const escapedText = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inlineMarkdown = (s) => {
    let r = escapedText(s);
    // Bold: **text**
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
    r = r.replace(/_(.+?)_/g, '<em>$1</em>');
    // Inline code: `code`
    r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
    return r;
  };

  for (const line of lines) {
    // Code block fence
    if (line.startsWith('```')) {
      if (!inPre) {
        closeList();
        inPre = true;
        preContent = '';
      } else {
        result.push(`<pre><code>${escapedText(preContent.trim())}</code></pre>`);
        inPre = false;
        preContent = '';
      }
      continue;
    }
    if (inPre) { preContent += line + '\n'; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      closeList();
      result.push('<hr/>');
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h3) { closeList(); result.push(`<h3>${inlineMarkdown(h3[1])}</h3>`); continue; }
    if (h2) { closeList(); result.push(`<h2>${inlineMarkdown(h2[1])}</h2>`); continue; }
    if (h1) { closeList(); result.push(`<h1>${inlineMarkdown(h1[1])}</h1>`); continue; }

    // Blockquote
    const bq = line.match(/^> (.+)/);
    if (bq) { closeList(); result.push(`<blockquote>${inlineMarkdown(bq[1])}</blockquote>`); continue; }

    // Unordered list
    const ul = line.match(/^[-*] (.+)/);
    if (ul) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) { result.push('<ul>'); inUl = true; }
      result.push(`<li>${inlineMarkdown(ul[1])}</li>`);
      continue;
    }

    // Ordered list
    const ol = line.match(/^\d+\. (.+)/);
    if (ol) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol>'); inOl = true; }
      result.push(`<li>${inlineMarkdown(ol[1])}</li>`);
      continue;
    }

    // Table rows
    if (line.startsWith('|')) {
      closeList();
      const cells = line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
      // Detect separator row
      if (cells.every((c) => /^[-:\s]+$/.test(c))) {
        continue; // skip divider row
      }
      result.push(
        `<tr>${cells.map((c) => `<td>${inlineMarkdown(c.trim())}</td>`).join('')}</tr>`
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      closeList();
      result.push('<p></p>');
      continue;
    }

    // Regular paragraph text
    closeList();
    result.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();

  // Wrap table rows
  let html = result.join('\n');
  html = html.replace(/((<tr>.*?<\/tr>\n?)+)/gs, (match) => {
    const rows = match.trim().split('\n');
    const header = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    const body = rows.slice(1).join('\n');
    return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  });

  return html;
}

function MarkdownContent({ text }) {
  const html = renderMarkdown(text || '');
  // We built the HTML ourselves without user-supplied tags, so dangerouslySetInnerHTML is safe here.
  // User text goes through escapedText() before any HTML wrapping.
  return <div className="ai-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="ai-typing">
      <div className="ai-typing-dot" />
      <div className="ai-typing-dot" />
      <div className="ai-typing-dot" />
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`ai-message ${isUser ? 'user-msg' : 'assistant-msg'}`}>
      <div className="ai-bubble">
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <MarkdownContent text={message.content} />
        )}
      </div>
      {time && <span className="ai-msg-time">{time}</span>}
    </div>
  );
}

// ── Conversation item ──────────────────────────────────────────────────────────
function ConvItem({ conv, isActive, onSelect, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(conv.title);
  const inputRef = useRef(null);

  const startRename = (e) => {
    e.stopPropagation();
    setNewTitle(conv.title);
    setRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitRename = () => {
    const t = newTitle.trim();
    if (t && t !== conv.title) onRename(conv.id, t);
    setRenaming(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setRenaming(false); setNewTitle(conv.title); }
  };

  return (
    <div
      className={`ai-conv-item ${isActive ? 'active' : ''}`}
      onClick={() => !renaming && onSelect(conv.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !renaming && onSelect(conv.id)}
      aria-current={isActive}
    >
      <Icon name="messageCircle" size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
      {renaming ? (
        <input
          ref={inputRef}
          className="ai-rename-input"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          maxLength={255}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="ai-conv-title">{conv.title}</span>
      )}
      {!renaming && (
        <div className="ai-conv-actions">
          <button
            className="ai-conv-action-btn"
            onClick={startRename}
            title="Rename"
            aria-label="Rename conversation"
          >
            <Icon name="pencil" size={12} />
          </button>
          <button
            className="ai-conv-action-btn danger"
            onClick={(e) => { e.stopPropagation(); onDelete(conv); }}
            title="Delete"
            aria-label="Delete conversation"
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Welcome Screen ─────────────────────────────────────────────────────────────
function WelcomeScreen({ onSuggestion }) {
  return (
    <div className="ai-welcome">
      <div className="ai-welcome-icon">
        <Icon name="sparkles" size={32} />
      </div>
      <h2>Your money. Your questions. Your AI assistant.</h2>
      <p>Understand your spending, explore your financial habits, and make smarter financial decisions.</p>

      <div className="ai-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="ai-suggestion-card" onClick={() => onSuggestion(s)}>
            {s}
          </button>
        ))}
      </div>

      <p className="ai-welcome-notice">
        🔒 Your financial data may be sent to Google Gemini to answer your questions.
        SmartSpend AI is for informational purposes only — not certified financial advice.
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AiChatPage() {
  const toast = useToast();
  const headingId = useId();

  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState(null);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef(null);

  // Composer state
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Track active conversation ID in a ref to prevent stale closure issues
  const activeConvIdRef = useRef(activeConvId);
  activeConvIdRef.current = activeConvId;

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const data = await aiService.listConversations();
      setConversations(data);
    } catch (_) {
      // silently fail – user sees empty list
    } finally {
      setConvsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // ── Select a conversation ─────────────────────────────────────────────────
  const selectConversation = useCallback(async (id) => {
    if (id === activeConvId) return;
    // Cancel any active stream for the old conversation
    abortRef.current?.abort();

    setActiveConvId(id);
    setSidebarOpen(false);
    setMsgsLoading(true);
    setMessages([]);
    setStreamingText('');
    setStreaming(false);

    try {
      const data = await aiService.getConversation(id);
      setMessages(data.messages || []);
    } catch (_) {
      toast.error('Could not load conversation.');
    } finally {
      setMsgsLoading(false);
    }
  }, [activeConvId, toast]);

  // ── Create new conversation ───────────────────────────────────────────────
  const createConversation = useCallback(async (firstMessage) => {
    try {
      const convo = await aiService.createConversation('New Chat');
      setConversations((prev) => [convo, ...prev]);
      setActiveConvId(convo.id);
      setMessages([]);
      setStreamingText('');
      setSidebarOpen(false);
      return convo.id;
    } catch (_) {
      toast.error('Could not create conversation.');
      return null;
    }
  }, [toast]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || streaming) return;
    if (trimmed.length > 4000) {
      toast.error('Message is too long (max 4000 characters).');
      return;
    }

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    const userMsg = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setStreaming(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = '';

    await sendMessageStream(convId, trimmed, controller.signal, {
      onStart: () => {},
      onDelta: (chunk) => {
        // Only update if we're still on the same conversation
        if (activeConvIdRef.current !== convId) return;
        fullText += chunk;
        setStreamingText(fullText);
      },
      onDone: () => {
        if (activeConvIdRef.current !== convId) return;
        const assistantMsg = {
          id: `tmp-asst-${Date.now()}`,
          role: 'assistant',
          content: fullText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingText('');
        setStreaming(false);
        // Refresh conversation list to get updated title and updated_at
        loadConversations();
      },
      onError: (msg) => {
        if (activeConvIdRef.current !== convId) return;
        setStreamingText('');
        setStreaming(false);
        toast.error(msg || 'SmartSpend AI encountered an error.');
        // Remove the user message if the AI failed
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      },
    });

    // Ensure we reset streaming state even if callbacks didn't fire
    setStreaming((s) => {
      if (s) { setStreamingText(''); return false; }
      return s;
    });
  }, [input, streaming, activeConvId, createConversation, loadConversations, toast]);

  // ── Stop generation ───────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingText('');
  }, []);

  // ── Rename conversation ───────────────────────────────────────────────────
  const renameConversation = useCallback(async (id, title) => {
    try {
      await aiService.renameConversation(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    } catch (_) {
      toast.error('Could not rename conversation.');
    }
  }, [toast]);

  // ── Delete conversation ───────────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await aiService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      toast.success('Conversation deleted.');
    } catch (_) {
      toast.error('Could not delete conversation.');
    }
  }, [deleteTarget, activeConvId, toast]);

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Suggestion click ──────────────────────────────────────────────────────
  const handleSuggestion = useCallback((text) => {
    sendMessage(text);
  }, [sendMessage]);

  // ────────────────────────────────────────────────────────────────────────────
  const activeConv = conversations.find((c) => c.id === activeConvId);
  const hasActiveConv = Boolean(activeConvId);
  const canSend = input.trim().length > 0 && !streaming;

  return (
    <div className="ai-chat-page" aria-labelledby={headingId}>
      {/* ── Conversation sidebar ───────────────────────────────────── */}
      <aside className={`ai-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Conversations">
        <div className="ai-sidebar-header">
          <button className="btn btn-outline btn-sm" onClick={createConversation}>
            <Icon name="plus" size={16} />
            New Chat
          </button>
        </div>

        <div className="ai-conv-list" role="list">
          {convsLoading ? (
            <div className="ai-sidebar-empty">Loading conversations…</div>
          ) : conversations.length === 0 ? (
            <div className="ai-sidebar-empty">
              No conversations yet.<br />Start a new chat above.
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConvId}
                onSelect={selectConversation}
                onRename={renameConversation}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="ai-sidebar-overlay show"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main chat area ─────────────────────────────────────────── */}
      <div className="ai-main">
        {/* Header */}
        <header className="ai-chat-header">
          {/* Mobile: hamburger to open sidebar */}
          <button
            className="icon-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle conversation list"
            style={{ display: 'none' }}
            id="ai-sidebar-toggle"
          >
            <Icon name="transactions" size={20} />
          </button>
          <div className="ai-header-icon">
            <Icon name="sparkles" size={20} />
          </div>
          <div className="ai-header-info">
            <h2 id={headingId}>SmartSpend AI</h2>
            <p>
              {activeConv
                ? activeConv.title === 'New Chat' ? 'New conversation' : activeConv.title
                : 'Your personal financial assistant.'}
            </p>
          </div>
          {/* Mobile sidebar toggle (visible via CSS) */}
          <button
            className="icon-btn mobile-only"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Open conversation list"
            aria-expanded={sidebarOpen}
          >
            <Icon name="transactions" size={20} />
          </button>
        </header>

        {/* Messages / welcome */}
        <div className="ai-messages" role="log" aria-live="polite">
          {!hasActiveConv ? (
            <WelcomeScreen onSuggestion={handleSuggestion} />
          ) : msgsLoading ? (
            <div className="center-state">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {messages.length === 0 && !streaming && (
                <WelcomeScreen onSuggestion={handleSuggestion} />
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {/* Streaming bubble */}
              {streaming && streamingText && (
                <div className="ai-message assistant-msg">
                  <div className="ai-bubble">
                    <MarkdownContent text={streamingText} />
                  </div>
                </div>
              )}
              {/* Typing indicator while waiting for first token */}
              {streaming && !streamingText && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Composer */}
        <div className="ai-composer">
          <div className="ai-composer-inner">
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              placeholder={hasActiveConv ? 'Ask anything about your finances…' : 'Start a new chat or pick a suggestion above…'}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={4000}
              disabled={streaming && !streamingText}
              aria-label="Message input"
            />
            {streaming ? (
              <button
                className="ai-send-btn ai-stop-btn"
                onClick={stopGeneration}
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Icon name="stop" size={16} />
              </button>
            ) : (
              <button
                className="ai-send-btn"
                onClick={() => sendMessage()}
                disabled={!canSend}
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <Icon name="send" size={16} />
              </button>
            )}
          </div>
          <p className="ai-composer-hint">
            Enter to send · Shift+Enter for new line · SmartSpend AI may make mistakes.
          </p>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Conversation"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

