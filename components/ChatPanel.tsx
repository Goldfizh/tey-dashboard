'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { DashboardContext } from '@/app/api/chat/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Welk kanaal presteert het beste op basis van de huidige data?',
  'Geef advies voor de volgende campagne op basis van de vacaturedata.',
  'Welke campagne heeft de laagste CPA en wat kunnen we hiervan leren?',
  'Hoe verbeteren we de sollicitatiefunnel voor de slechtst presterende vacature?',
  'Wat is het advies voor budgetverdeling over de kanalen?',
];

// ── ID helper ─────────────────────────────────────────────────────────────────
let _id = 0;
const nextId = () => `msg-${++_id}`;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  context: DashboardContext;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatPanel({ context }: Props) {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: nextId(), role: 'user', content: text.trim() };
    const assistantMsg: Message = { id: nextId(), role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const history: Message[] = [...messages, userMsg];

    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('Lege response');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // Remove empty assistant bubble on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.content.length > 0));
    } finally {
      setLoading(false);
    }
  }, [loading, messages, context]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI-chat"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#1E3A8A',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99,49,244,0.40)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#16295E')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#1E3A8A')}
      >
        {open ? <IconClose /> : <IconChat />}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            zIndex: 50,
            width: 'min(420px, calc(100vw - 48px))',
            height: 'min(600px, calc(100vh - 120px))',
            background: '#ffffff',
            border: '1px solid #DCE0E6',
            borderRadius: '16px',
            boxShadow: '0 24px 64px rgba(18,16,34,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #DCE0E6',
              background: '#FAFAFA',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#1E3A8A',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0B1020', lineHeight: 1.2, margin: 0 }}>
                  AI Campagne-adviseur
                </p>
                <p style={{ fontSize: '11px', color: '#8C9BAF', margin: 0 }}>
                  Gesteld op actuele dashboarddata
                </p>
              </div>
            </div>
            {hasMessages && (
              <button
                onClick={clearChat}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                  color: '#8C9BAF', border: '1px solid #DCE0E6', borderRadius: '6px',
                  background: 'transparent', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#555E6C'; e.currentTarget.style.borderColor = '#BCC4CF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#8C9BAF'; e.currentTarget.style.borderColor = '#DCE0E6'; }}
              >
                Wissen
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Empty state: suggestion chips */}
            {!hasMessages && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BCC4CF', marginBottom: '12px' }}>
                  Stel een vraag over de data
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{
                        textAlign: 'left', fontSize: '12px', padding: '10px 12px',
                        background: '#F0F4F8', border: '1px solid #DCE0E6', borderRadius: '8px',
                        color: '#555E6C', lineHeight: 1.4, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#E8EDF3'; e.currentTarget.style.borderColor = '#1E3A8A'; e.currentTarget.style.color = '#1E3A8A'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F0F4F8'; e.currentTarget.style.borderColor = '#DCE0E6'; e.currentTarget.style.color = '#555E6C'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: isUser ? '85%' : '100%',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      padding: '10px 12px',
                      borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: isUser ? '#1E3A8A' : '#F0F4F8',
                      color: isUser ? '#ffffff' : '#0B1020',
                      wordBreak: 'break-word',
                    }}
                  >
                    {!m.content ? (
                      /* Streaming dots while empty */
                      <span style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '16px' }}>
                        {[0, 1, 2].map((i) => (
                          <span key={i} style={{
                            width: 6, height: 6, borderRadius: '50%', background: '#8C9BAF', display: 'inline-block',
                            animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </span>
                    ) : isUser ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                    ) : (
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', marginTop: '10px', color: '#0B1020' }}>{children}</p>,
                          h2: ({ children }) => <p style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', marginTop: '10px', color: '#0B1020' }}>{children}</p>,
                          h3: ({ children }) => <p style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', marginTop: '8px', color: '#555E6C' }}>{children}</p>,
                          p:  ({ children }) => <p style={{ marginBottom: '6px', marginTop: 0 }}>{children}</p>,
                          ul: ({ children }) => <ul style={{ paddingLeft: '16px', marginBottom: '6px', marginTop: '2px' }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ paddingLeft: '16px', marginBottom: '6px', marginTop: '2px' }}>{children}</ol>,
                          li: ({ children }) => <li style={{ marginBottom: '3px' }}>{children}</li>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700, color: '#0B1020' }}>{children}</strong>,
                          em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                          hr: () => <hr style={{ border: 'none', borderTop: '1px solid #DCE0E6', margin: '8px 0' }} />,
                          code: ({ children }) => <code style={{ background: '#E8EDF3', borderRadius: '3px', padding: '1px 4px', fontSize: '11px', fontFamily: 'monospace' }}>{children}</code>,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Error */}
            {error && (
              <div style={{
                fontSize: '12px', padding: '10px 12px',
                background: '#FEF2F2', color: '#B91C1C',
                borderRadius: '8px', border: '1px solid #FECACA',
              }}>
                ⚠ {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ flexShrink: 0, padding: '12px', borderTop: '1px solid #DCE0E6', background: '#FAFAFA' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Stel een vraag over de campagnedata…"
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  resize: 'none',
                  fontSize: '12px',
                  padding: '10px 12px',
                  border: '1px solid #DCE0E6',
                  borderRadius: '8px',
                  color: '#0B1020',
                  background: '#ffffff',
                  maxHeight: '80px',
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                  outline: 'none',
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#1E3A8A')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#DCE0E6')}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                style={{
                  width: 36, height: 36, flexShrink: 0,
                  borderRadius: '8px', background: '#1E3A8A', color: '#ffffff',
                  border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: (!input.trim() || loading) ? 0.4 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#16295E'; }}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1E3A8A')}
              >
                <IconSend />
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', color: '#BCC4CF' }}>
              Enter om te verzenden · Shift+Enter voor nieuwe regel
            </p>
          </div>
        </div>
      )}

      {/* Bounce animation */}
      <style>{`
        @keyframes chatBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
