import { Router, Response } from 'express';
import db from '../database.js';
import { AuthRequest, optionalAuth } from '../middleware/auth.js';
import { getQuote, getAllQuotes, searchStocks, getStockDetails, getHistoricalData } from '../services/marketData.js';

const router = Router();

function parsePagination(req: any): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 5000);
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
  return { limit, offset };
}

router.get('/stocks', (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const stocks = getAllQuotes(limit, offset);
    res.json(stocks);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

router.get('/stocks/search', async (req, res) => {
  try {
    const query = (req.query.q as string) || '';
    const { limit, offset } = parsePagination(req);
    if (!query.trim()) {
      return res.json([]);
    }
    const results = await searchStocks(query, limit, offset);
    res.json(results);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

router.get('/stocks/:symbol', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const details = getStockDetails(symbol.toUpperCase());

    if (!details) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    let inWatchlist = false;
    if (req.userId) {
      const wl = db.prepare('SELECT id FROM watchlist WHERE user_id = ? AND symbol = ?')
        .get(req.userId, symbol.toUpperCase());
      inWatchlist = !!wl;
    }

    res.json({
      ...details,
      exchange: details.exchange || 'US',
      data_status: details.data_status || 'UNAVAILABLE',
      inWatchlist,
    });
  } catch (error) {
    console.error('Error fetching stock details:', error);
    res.status(500).json({ error: 'Failed to fetch stock details' });
  }
});

router.get('/stocks/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const history = await getHistoricalData(symbol.toUpperCase(), days);
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

export default router;
