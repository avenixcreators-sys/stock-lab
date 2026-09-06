const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const HISTORY_KEY = 'stocklab_ai_history';

function getHistory(): { role: string; content: string }[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveHistory(h: { role: string; content: string }[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
}

export interface AISTatus {
  configured: boolean;
  disclaimer: string;
}

export function getStatus(): AISTatus {
  return {
    configured: Boolean(GROQ_KEY),
    disclaimer: 'StockLab AI Teacher can make mistakes. Educational use only — not financial advice.',
  };
}

export function getHistoryData(): { history: { role: string; content: string }[] } {
  return { history: getHistory() };
}

export async function clearHistory(): Promise<{ success: boolean }> {
  saveHistory([]);
  return { success: true };
}

export async function chat(message: string): Promise<{ reply: string }> {
  if (!GROQ_KEY) throw new Error('Groq API key not configured.');
  const history = getHistory();
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: message },
  ];
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: false,
      temperature: 0.7,
    }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error?.message || `Groq API error ${r.status}`);
  }
  const j = await r.json();
  const reply = j.choices?.[0]?.message?.content || 'No response.';
  const newHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }];
  saveHistory(newHistory);
  return { reply };
}
