import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { isAiConfigured, askTeacher, getChatHistory, clearChatHistory, AI_TEACHER_DISCLAIMER } from '../services/ai.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({
    configured: isAiConfigured(),
    disclaimer: AI_TEACHER_DISCLAIMER,
  });
});

router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json({
        error: 'AI Teacher is not configured. Please add GROQ_API_KEY to backend/.env.',
      });
    }

    const userId = req.userId!;
    const message = (req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });
    }

    const history = await getChatHistory(userId, 16);
    const result = await askTeacher(userId, message, history);

    res.json(result);
  } catch (error: any) {
    console.error('AI Teacher error:', error?.message || error);
    if (error?.status === 503) return res.status(503).json({ error: error.message });
    const msg = String(error?.message || '');
    if (/authentication|api key|401|unauthorized/i.test(msg)) {
      return res.status(502).json({ error: 'AI Teacher provider rejected the API key.' });
    }
    if (/rate|429/i.test(msg)) {
      return res.status(429).json({ error: 'AI Teacher is rate-limited. Please wait a moment and try again.' });
    }
    res.status(500).json({ error: 'Failed to reach the AI Teacher. Please try again shortly.' });
  }
});

router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await getChatHistory(userId, limit);
    res.json({ history });
  } catch (error) {
    console.error('AI history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

router.post('/clear', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await clearChatHistory(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('AI clear error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
