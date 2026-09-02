import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getQuote } from '../services/marketData.js';
import { checkAndAwardBadges } from '../services/achievements.js';

const router = Router();

router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const items = db.prepare(`
      SELECT w.*, s.name, s.sector
      FROM watchlist w
      JOIN stocks s ON w.symbol = s.symbol
      WHERE w.user_id = ?
      ORDER BY w.added_at DESC
    `).all(userId) as any[];

    const enriched = items.map(item => {
      const quote = getQuote(item.symbol);
      return {
        symbol: item.symbol,
        name: item.name,
        sector: item.sector,
        price: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
        addedAt: item.added_at
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Watchlist error:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

router.post('/add', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const existing = db.prepare('SELECT id FROM watchlist WHERE user_id = ? AND symbol = ?')
      .get(userId, symbol.toUpperCase());

    if (existing) {
      return res.status(409).json({ error: 'Already in watchlist' });
    }

    db.prepare('INSERT INTO watchlist (id, user_id, symbol) VALUES (?, ?, ?)')
      .run(uuidv4(), userId, symbol.toUpperCase());

    const newlyAwardedBadges = checkAndAwardBadges(userId);

    res.json({ success: true, symbol: symbol.toUpperCase(), newlyAwardedBadges });
  } catch (error) {
    console.error('Add watchlist error:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

router.post('/remove', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND symbol = ?')
      .run(userId, symbol.toUpperCase());

    res.json({ success: true, symbol: symbol.toUpperCase() });
  } catch (error) {
    console.error('Remove watchlist error:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

export default router;
