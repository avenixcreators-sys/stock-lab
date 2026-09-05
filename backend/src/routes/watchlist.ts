import { Router } from 'express';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getQuote } from '../services/marketData.js';
import {
  getWatchlist,
  addWatchItem,
  removeWatchItem,
  computeAndAwardBadges,
} from '../services/firestoreStore.js';

const router = Router();

function getSector(symbol: string): string | null {
  const row: any = db.prepare('SELECT sector FROM stocks WHERE symbol = ?').get(symbol);
  return row?.sector || null;
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const items = await getWatchlist(userId);

    const enriched = items.map((item) => {
      const quote = getQuote(item.symbol);
      return {
        symbol: item.symbol,
        name: item.companyName,
        sector: getSector(item.symbol),
        price: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
        addedAt: item.addedAt,
      };
    });

    res.json(enriched);
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Watchlist error:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

router.post('/add', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const sym = symbol.toUpperCase();
    const created = await addWatchItem(userId, sym);

    if (!created) {
      return res.status(409).json({ error: 'Already in watchlist' });
    }

    const newlyAwardedBadges = await computeAndAwardBadges(userId);

    res.json({ success: true, symbol: sym, newlyAwardedBadges });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Add watchlist error:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

router.post('/remove', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    await removeWatchItem(userId, symbol);
    res.json({ success: true, symbol: symbol.toUpperCase() });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Remove watchlist error:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

export default router;
