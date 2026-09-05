import { Router, Response } from 'express';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getQuote } from '../services/marketData.js';
import {
  getHoldings,
  getTransactions,
  runBuy,
  runSell,
  getUserCash,
  computeAndAwardBadges,
} from '../services/firestoreStore.js';

const router = Router();

function getStockMeta(symbol: string): { name: string; sector: string | null } {
  const row: any = db.prepare('SELECT name, sector FROM stocks WHERE symbol = ?').get(symbol);
  return { name: row?.name || symbol, sector: row?.sector || null };
}

router.get('/portfolio', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cashBalance = await getUserCash(userId);
    const holdings = await getHoldings(userId);

    let totalHoldingsValue = 0;
    const enrichedHoldings = holdings.map((h) => {
      const meta = getStockMeta(h.symbol);
      const quote = getQuote(h.symbol);
      const currentPrice = quote?.price || h.averagePrice;
      const currentValue = currentPrice * h.quantity;
      const costBasis = h.averagePrice * h.quantity;
      const profitLoss = currentValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      totalHoldingsValue += currentValue;

      return {
        symbol: h.symbol,
        name: meta.name,
        sector: meta.sector,
        quantity: h.quantity,
        avgPurchasePrice: h.averagePrice,
        currentPrice,
        currentValue,
        profitLoss,
        profitLossPercent,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
      };
    });

    const portfolioValue = cashBalance + totalHoldingsValue;
    const totalInvested = holdings.reduce((sum, h) => sum + h.averagePrice * h.quantity, 0);
    const totalProfitLoss = totalHoldingsValue - totalInvested;

    res.json({
      cashBalance: Math.round(cashBalance * 100) / 100,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      totalHoldingsValue: Math.round(totalHoldingsValue * 100) / 100,
      totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
      holdings: enrichedHoldings.map((h) => ({
        ...h,
        currentValue: Math.round(h.currentValue * 100) / 100,
        profitLoss: Math.round(h.profitLoss * 100) / 100,
        avgPurchasePrice: Math.round(h.avgPurchasePrice * 100) / 100,
        currentPrice: Math.round(h.currentPrice * 100) / 100,
      })),
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

router.post('/buy', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { symbol, quantity } = req.body;

    if (!symbol || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Valid symbol and positive integer quantity required' });
    }
    if (quantity > 10000) {
      return res.status(400).json({ error: 'Maximum 10,000 shares per order' });
    }

    const sym = symbol.toUpperCase();
    const quote = getQuote(sym);
    if (!quote || quote.price == null) {
      return res.status(404).json({ error: 'Stock data unavailable. Please try again shortly.' });
    }

    const result = await runBuy(userId, sym, quantity, quote.price);
    const newlyAwardedBadges = await computeAndAwardBadges(userId);

    res.json({
      success: true,
      transaction: {
        type: 'buy',
        symbol: sym,
        name: getStockMeta(sym).name,
        quantity,
        price: quote.price,
        totalCost: result.transaction.totalValue,
      },
      newCashBalance: result.newCashBalance,
      newlyAwardedBadges,
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 400) {
      const e: any = error;
      return res.status(400).json({ error: e.message, required: e.required, available: e.available });
    }
    if (status === 401) return res.status(401).json({ error: (error as Error).message });
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Buy error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

router.post('/sell', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { symbol, quantity } = req.body;

    if (!symbol || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Valid symbol and positive integer quantity required' });
    }
    if (quantity > 10000) {
      return res.status(400).json({ error: 'Maximum 10,000 shares per order' });
    }

    const sym = symbol.toUpperCase();
    const quote = getQuote(sym);
    if (!quote || quote.price == null) {
      return res.status(404).json({ error: 'Stock data unavailable. Please try again shortly.' });
    }

    const result = await runSell(userId, sym, quantity, quote.price);
    const newlyAwardedBadges = await computeAndAwardBadges(userId);

    res.json({
      success: true,
      transaction: {
        type: 'sell',
        symbol: sym,
        name: getStockMeta(sym).name,
        quantity,
        price: quote.price,
        totalProceeds: result.transaction.totalValue,
      },
      newCashBalance: result.newCashBalance,
      newlyAwardedBadges,
    });
  } catch (error) {
    const status = (error as any).status;
    if (status === 400) {
      const e: any = error;
      return res.status(400).json({ error: e.message, owned: e.owned, requested: e.requested });
    }
    if (status === 401) return res.status(401).json({ error: (error as Error).message });
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Sell error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const filter = (req.query.filter as string) || '';
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await getTransactions(userId, filter as 'buy' | 'sell' | '', limit);
    res.json(
      transactions.map((t) => ({
        id: t.id,
        type: t.type,
        symbol: t.symbol,
        name: t.companyName,
        quantity: t.quantity,
        price: t.price,
        totalValue: t.totalValue,
        createdAt: t.createdAt,
      }))
    );
  } catch (error) {
    const status = (error as any).status;
    if (status === 503) return res.status(503).json({ error: (error as Error).message });
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
