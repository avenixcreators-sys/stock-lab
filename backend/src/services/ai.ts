import OpenAI from 'openai';
import { getFirestore, isFirebaseReady } from './firebase.js';

/**
 * AI Teacher backed by Groq (OpenAI-compatible endpoint).
 *
 * The Groq API key lives ONLY in backend/.env (GROQ_API_KEY) and is never
 * exposed to the frontend. All requests go through this backend so the safety
 * system prompt + educational disclaimer are always applied and chat history
 * is stored per-user in Firestore.
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL = process.env.AI_TEACHER_MODEL || 'qwen/qwen3.8-27b';

export const AI_TEACHER_DISCLAIMER =
  'StockLab is an educational stock-market simulator (Demo Market). All money and trades are virtual. ' +
  'The AI Teacher provides general educational information only and is NOT financial, investment, or ' +
  'legal advice. It does not guarantee any returns and will not provide personalized recommendations for ' +
  'real-money investing. Past performance never guarantees future results. Always do your own research and ' +
  'consult a licensed financial advisor before making any real investment decisions.';

const SYSTEM_PROMPT = `You are the "AI Teacher" for StockLab, an educational stock-market simulator for beginners.

Your job is to TEACH stock-market and personal-finance concepts in clear, simple language, suitable for a total beginner.

Guidelines you MUST follow on every reply:
- Keep answers educational, friendly, and beginner-friendly. Prefer plain English over jargon; explain any jargon you use.
- Stay within 200-300 words unless the user asks for more detail.
- Never claim guaranteed returns, never predict specific future prices, and never present opinion as fact.
- NEVER give personalized investment advice for real money (do not tell the user which real stocks to buy/sell with their real money). You may explain hypothetical examples as illustrations, but always make clear they are hypothetical.
- Never fabricate quotes, prices, or fake stock data. If you do not know a current price or fact, say so and explain how the user can verify it. You may reason about how the simulator works instead.
- If asked for medical, legal, or tax advice, politely decline and redirect to the applicable professional.
- If asked anything harmful, off-topic, or unrelated to finance/education, gently redirect back to investing education.

Always end substantive answers by reminding the user that this is educational and not financial advice, and mention the disclaimer where appropriate.`;

function chatMessagesRef(userId: string): FirebaseFirestore.CollectionReference | null {
  if (!isFirebaseReady()) return null;
  const fs = getFirestore();
  return fs ? fs.collection('users').doc(userId).collection('aiTeacherChats') : null;
}

export function isAiConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getChatHistory(userId: string, limit = 20): Promise<ChatMessage[]> {
  const col = chatMessagesRef(userId);
  if (!col) return [];
  const snap = await col
    .orderBy('createdAt', 'desc')
    .limit(Math.max(1, Math.min(limit, 50)))
    .get();
  const mapped = snap.docs.map((d) => {
    const x = d.data();
    return { role: x.role as 'user' | 'assistant', content: x.content as string };
  });
  return mapped.reverse();
}

/** Removes the user's AI Teacher chat history (best-effort; empty when no Firestore). */
export async function clearChatHistory(userId: string): Promise<boolean> {
  const col = chatMessagesRef(userId);
  if (!col) return false;
  const snap = await col.listDocuments();
  const fs = getFirestore();
  if (!fs) return false;
  const batch = fs.batch();
  snap.forEach((doc) => batch.delete(doc));
  await batch.commit();
  return true;
}

async function saveChatMessage(userId: string, role: 'user' | 'assistant', content: string, ref: FirebaseFirestore.WriteBatch | null): Promise<void> {
  const col = chatMessagesRef(userId);
  if (!col) return;
  const doc = col.doc();
  const data = { role, content, createdAt: new Date().toISOString() };
  if (ref) {
    ref.set(doc, data);
  } else {
    await doc.set(data);
  }
}

export interface AskResult {
  reply: string;
  disclaimer: string;
  usage?: { promptTokens: number; completionTokens: number };
}

/**
 * Sends a user message to the AI Teacher.
 * @throws Error if Groq is not configured (caller maps to 503).
 */
export async function askTeacher(
  userId: string,
  message: string,
  history: ChatMessage[] = []
): Promise<AskResult> {
  if (!isAiConfigured() || !process.env.GROQ_API_KEY) {
    throw new Error('AI Teacher is not configured. Add GROQ_API_KEY to backend/.env.');
  }

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  });

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-16),
    { role: 'user', content: message },
  ];

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 600,
    temperature: 0.6,
  });

  const reply =
    completion.choices?.[0]?.message?.content?.trim() ||
    'Sorry, I could not generate a response. Please try again.';

  // Persist in a batch if Firestore is available (best-effort).
  const col = chatMessagesRef(userId);
  let batch: FirebaseFirestore.WriteBatch | null = null;
  if (col) {
    const fs = getFirestore()!;
    batch = fs.batch();
    await saveChatMessage(userId, 'user', message, batch);
    await saveChatMessage(userId, 'assistant', reply, batch);
    await batch.commit();
  }

  return {
    reply,
    disclaimer: AI_TEACHER_DISCLAIMER,
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}
