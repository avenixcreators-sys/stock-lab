import { Router } from 'express';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/profile', (req: AuthRequest, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, avatar_url, cash_balance, created_at FROM users WHERE id = ?')
      .get(req.userId!) as any;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const transactionCount = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ?').get(req.userId!) as any;
    const achievements = db.prepare('SELECT COUNT(*) as c FROM achievements WHERE user_id = ?').get(req.userId!) as any;
    const quizResults = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0').get(req.userId!) as any;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      cashBalance: user.cash_balance,
      createdAt: user.created_at,
      stats: {
        transactions: transactionCount.c,
        achievements: achievements.c,
        lessonsCompleted: quizResults.c
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    db.prepare(`UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(name.trim(), req.userId!);

    res.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/stats', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const user = db.prepare('SELECT cash_balance FROM users WHERE id = ?').get(userId) as any;
    const holdings = db.prepare('SELECT * FROM holdings WHERE user_id = ? AND quantity > 0').all(userId) as any[];
    const transactions = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ?').get(userId) as any;
    const achievements = db.prepare('SELECT COUNT(*) as c FROM achievements WHERE user_id = ?').get(userId) as any;
    const quizResults = db.prepare('SELECT COUNT(DISTINCT lesson_id) as c FROM quiz_results WHERE user_id = ? AND score > 0').get(userId) as any;

    const totalShares = holdings.reduce((sum: number, h: any) => sum + h.quantity, 0);
    const uniqueStocks = holdings.length;

    res.json({
      cashBalance: user.cash_balance,
      totalShares,
      uniqueStocks,
      totalTransactions: transactions.c,
      totalAchievements: achievements.c,
      lessonsCompleted: quizResults.c,
      memberSince: db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
