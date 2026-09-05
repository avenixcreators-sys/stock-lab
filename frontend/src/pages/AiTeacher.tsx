import { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Trash2,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  LineChart,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '../utils/helpers';
import { LoadingState } from '../components/StateComponents';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StatusData {
  configured: boolean;
  disclaimer: string;
}

const SUGGESTIONS = [
  { label: 'What is P/E ratio?', icon: TrendingUp },
  { label: 'What is diversification?', icon: ShieldCheck },
  { label: 'How does the simulator work?', icon: BookOpen },
  { label: 'What is a stock?', icon: GraduationCap },
  { label: 'Explain NIFTY vs SENSEX', icon: LineChart },
];

export default function AiTeacher() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/ai/status');
        const data: StatusData = await res.json();
        setConfigured(data.configured);
        setDisclaimer(data.disclaimer || '');
      } catch {
        setConfigured(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!configured) return;
    (async () => {
      try {
        const res = await apiFetch('/api/ai/history');
        const data = await res.json();
        if (data.history) setMessages(data.history);
      } catch {
        // ignore history load failures
      }
    })();
  }, [configured]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get a response');
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setError(e?.message || 'Failed to reach the AI Teacher. Please try again.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    setMessages([]);
    setError('');
    try {
      await apiFetch('/api/ai/clear', { method: 'POST' });
    } catch {
      // ignore clear failures
    }
  };

  if (loading) return <LoadingState text="Loading AI Teacher..." height="h-screen" />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white leading-tight flex items-center gap-1.5">
                AI Teacher
                <Sparkles className="w-4 h-4 text-primary-500" />
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Stocks &amp; personal finance tutor</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-danger transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear chat
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto w-full px-4 mt-3">
          <div className="rounded-xl bg-danger/10 border border-danger/30 p-3 text-sm text-danger flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {disclaimer && (
        <div className="max-w-3xl mx-auto w-full px-4 mt-3">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{disclaimer}</div>
          </div>
        </div>
      )}

      {!configured ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card text-center p-10 max-w-xl mx-auto">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white inline-block mb-4">
              <Bot className="w-9 h-9" />
            </div>
            <h2 className="font-semibold text-lg mb-2">AI Teacher is not configured yet</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
              Add a Groq API key (<code className="font-mono">GROQ_API_KEY</code>) to{' '}
              <code className="font-mono">backend/.env</code> and restart the server to unlock the
              AI Teacher.
            </p>
            <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 && !sending ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white mb-5">
                  <Bot className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
                  What would you like to know?
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-md">
                  Ask about stocks, markets, and personal finance — explained simply for beginners.
                </p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {msg.role === 'assistant' ? (
                        <div className="bg-gray-100 dark:bg-gray-800/70 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 dark:text-gray-200 markdown-body">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="max-w-[85%] ml-auto bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800/70 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-400 text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Composer (ChatGPT style) */}
          <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="max-w-3xl mx-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="flex flex-wrap justify-center gap-2 pb-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => send(s.label)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-950/30 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
                    >
                      <s.icon className="w-3.5 h-3.5 text-primary-500" />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500/40">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask a question..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent border-0 outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 py-1.5 max-h-40"
                />
                <button
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  className="p-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-[0.65rem] text-gray-400 mt-2">
                StockLab AI Teacher can make mistakes. Educational use only — not financial advice.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
