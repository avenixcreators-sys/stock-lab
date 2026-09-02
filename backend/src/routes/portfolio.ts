import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getQuote } from '../services/marketData.js';
import { checkAndAwardBadges } from '../services/achievements.js';

const router = Router();

router.get('/portfolio', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = db.prepare('SELECT cash_balance FROM users WHERE id = ?').get(userId) as any;
    const holdings = db.prepare(`
      SELECT h.*, s.name, s.sector
      FROM holdings h
      JOIN stocks s ON h.symbol = s.symbol
      WHERE h.user_id = ? AND h.quantity > 0
    `).all(userId) as any[];

    let totalHoldingsValue = 0;
    const enrichedHoldings = holdings.map(h => {
      const quote = getQuote(h.symbol);
      const currentPrice = quote?.price || h.avg_purchase_price;
      const currentValue = currentPrice * h.quantity;
      const costBasis = h.avg_purchase_price * h.quantity;
      const profitLoss = currentValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      totalHoldingsValue += currentValue;

      return {
        symbol: h.symbol,
        name: h.name,
        sector: h.sector,
        quantity: h.quantity,
        avgPurchasePrice: h.avg_purchase_price,
        currentPrice,
        currentValue,
        profitLoss,
        profitLossPercent,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0
      };
    });

    const cashBalance = user.cash_balance;
    const portfolioValue = cashBalance + totalHoldingsValue;
    const totalInvested = holdings.reduce((sum: number, h: any) => sum + (h.avg_purchase_price * h.quantity), 0);
    const totalProfitLoss = totalHoldingsValue - totalInvested;

    res.json({
      cashBalance: Math.round(cashBalance * 100) / 100,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      totalHoldingsValue: Math.round(totalHoldingsValue * 100) / 100,
      totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
      holdings: enrichedHoldings.map(h => ({ ...h, currentValue: Math.round(h.currentValue*100)/100, profitLoss: Math.round(h.profitLoss*100)/100, avgPurchasePrice: Math.round(h.avgPurchasePrice*100)/100, currentPrice: Math.round(h.currentPrice*100)/100 }))
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

router.post('/buy', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { symbol, quantity } = req.body;

    if (!symbol || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Valid symbol and positive integer quantity required' });
    }

    if (quantity > 10000) {
      return res.status(400).json({ error: 'Maximum 10,000 shares per order' });
    }

    const quote = getQuote(symbol.toUpperCase());
    if (!quote || quote.price == null) {
      return res.status(404).json({ error: 'Stock data unavailable. Please try again shortly.' });
    }

    const user = db.prepare('SELECT cash_balance FROM users WHERE id = ?').get(userId) as any;
    const totalCost = quote.price * quantity;

    if (user.cash_balance < totalCost) {
      return res.status(400).json({
        error: 'Insufficient cash',
        required: totalCost,
        available: user.cash_balance
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`UPDATE users SET cash_balance = cash_balance - ?, updated_at = datetime('now') WHERE id = ?`)
        .run(totalCost, userId);

      const existing = db.prepare('SELECT * FROM holdings WHERE user_id = ? AND symbol = ?')
        .get(userId, symbol.toUpperCase()) as any;

      if (existing) {
        const newQuantity = existing.quantity + quantity;
        const newAvgPrice = ((existing.avg_purchase_price * existing.quantity) + totalCost) / newQuantity;
        db.prepare(`UPDATE holdings SET quantity = ?, avg_purchase_price = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(newQuantity, Math.round(newAvgPrice * 100) / 100, existing.id);
      } else {
        db.prepare('INSERT INTO holdings (id, user_id, symbol, quantity, avg_purchase_price) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, symbol.toUpperCase(), quantity, quote.price);
      }

      db.prepare('INSERT INTO transactions (id, user_id, symbol, type, quantity, price, total_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), userId, symbol.toUpperCase(), 'buy', quantity, quote.price, totalCost);

      return db.prepare('SELECT cash_balance FROM users WHERE id = ?').get(userId) as any;
    });

    const updatedUser = transaction();
    const stock = db.prepare('SELECT name FROM stocks WHERE symbol = ?').get(symbol.toUpperCase()) as any;
    const newlyAwardedBadges = checkAndAwardBadges(userId);

    res.json({
      success: true,
      transaction: {
        type: 'buy',
        symbol: symbol.toUpperCase(),
        name: stock?.name || symbol,
        quantity,
        price: quote.price,
        totalCost
      },
      newCashBalance: Math.round(updatedUser.cash_balance * 100) / 100,
      newlyAwardedBadges
    });
  } catch (error) {
    console.error('Buy error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

router.post('/sell', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { symbol, quantity } = req.body;

    if (!symbol || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Valid symbol and positive integer quantity required' });
    }

    const holding = db.prepare('SELECT * FROM holdings WHERE user_id = ? AND symbol = ?')
      .get(userId, symbol.toUpperCase()) as any;

    if (!holding || holding.quantity < quantity) {
      return res.status(400).json({
        error: 'Insufficient shares',
        owned: holding?.quantity || 0,
        requested: quantity
      });
    }

    const quote = getQuote(symbol.toUpperCase());
    if (!quote || quote.price == null) {
      return res.status(404).json({ error: 'Stock data unavailable. Please try again shortly.' });
    }

    const totalProceeds = quote.price * quantity;

    const transaction = db.transaction(() => {
      db.prepare(`UPDATE users SET cash_balance = cash_balance + ?, updated_at = datetime('now') WHERE id = ?`)
        .run(totalProceeds, userId);

      const newQuantity = holding.quantity - quantity;
      if (newQuantity === 0) {
        db.prepare('DELETE FROM holdings WHERE id = ?').run(holding.id);
      } else {
        db.prepare(`UPDATE holdings SET quantity = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(newQuantity, holding.id);
      }

      db.prepare('INSERT INTO transactions (id, user_id, symbol, type, quantity, price, total_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), userId, symbol.toUpperCase(), 'sell', quantity, quote.price, totalProceeds);

      return db.prepare('SELECT cash_balance FROM users WHERE id = ?').get(userId) as any;
    });

    const updatedUser = transaction();
    const stock = db.prepare('SELECT name FROM stocks WHERE symbol = ?').get(symbol.toUpperCase()) as any;
    const newlyAwardedBadges = checkAndAwardBadges(userId);

    res.json({
      success: true,
      transaction: {
        type: 'sell',
        symbol: symbol.toUpperCase(),
        name: stock?.name || symbol,
        quantity,
        price: quote.price,
        totalProceeds
      },
      newCashBalance: Math.round(updatedUser.cash_balance * 100) / 100,
      newlyAwardedBadges
    });
  } catch (error) {
    console.error('Sell error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

router.get('/transactions', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const filter = req.query.filter as string;
    const limit = parseInt(req.query.limit as string) || 50;

    let query = `
      SELECT t.*, s.name
      FROM transactions t
      JOIN stocks s ON t.symbol = s.symbol
      WHERE t.user_id = ?
    `;
    const params: any[] = [userId];

    if (filter === 'buy' || filter === 'sell') {
      query += ' AND t.type = ?';
      params.push(filter);
    }

    query += ' ORDER BY t.created_at DESC LIMIT ?';
    params.push(limit);

    const transactions = db.prepare(query).all(...params);

    res.json(transactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      symbol: t.symbol,
      name: t.name,
      quantity: t.quantity,
      price: t.price,
      totalValue: t.total_value,
      createdAt: t.created_at
    })));
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
