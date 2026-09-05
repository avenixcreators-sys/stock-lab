import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getUser,
  updateUserProfile,
  getTransactions,
  getAchievements,
  getHoldings,
  countCompletedLessons,
} from '../services/firestoreStore.js';

const router = Router();

router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const user = await getUser(req.userId!);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [transactions, achievements, lessonsCompleted] = await Promise.all([
      getTransactions(req.userId!, '', 200).then((t) => t.length),
      getAchievements(req.userId!).then((a) => a.length),
      countCompletedLessons(req.userId!),
    ]);

    res.json({
      id: user.id,
      email: user.email,
      name: user.displayName,
      avatarUrl: user.avatarUrl,
      cashBalance: user.cashBalance,
      createdAt: user.createdAt,
      stats: {
        transactions,
        achievements,
        lessonsCompleted,
      },
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await updateUserProfile(req.userId!, name.trim());
    res.json({ success: true, name: name.trim() });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const [user, holdings, transactions, achievements, lessonsCompleted] = await Promise.all([
      getUser(userId),
      getHoldings(userId),
      getTransactions(userId, '', 200),
      getAchievements(userId),
      countCompletedLessons(userId),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalShares = holdings.reduce((sum, h) => sum + h.quantity, 0);
    const uniqueStocks = holdings.length;

    res.json({
      cashBalance: user.cashBalance,
      totalShares,
      uniqueStocks,
      totalTransactions: transactions.length,
      totalAchievements: achievements.length,
      lessonsCompleted,
      memberSince: user.createdAt,
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
