import { getCatalog, getQuote, getHistory, getQuotesBulk } from '../services/marketData';
import {
  getPortfolio, getHoldings, getTransactions, getWatchlist,
  addToWatchlist, removeFromWatchlist, executeTrade, getProfile, saveProfile,
} from '../services/firestore';
import { getStatus, getHistoryData, clearHistory, chat as groqChat } from '../services/ai';
import { auth } from '../firebase';

function makeResponse(data: any, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}
function errResponse(message: string, status = 400) {
  return makeResponse({ error: message }, status);
}
function uid() { return auth?.currentUser?.uid ?? null; }

export function formatCompact(n: number): string {
  if (n == null || Number.isNaN(n)) return '--';
  if (Math.abs(n) >= 1e8) return `₹${(n / 1e8).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e6) return `₹${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e4) return `₹${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
}
export function formatPercent(n: number): string {
  if (n == null || Number.isNaN(n)) return '--%';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const path = url.replace(/^\/api\//, '');
  const [p, ...rest] = path.split('?');
  const params = new URLSearchParams(rest.join('?'));
  const parts = p.split('/').filter(Boolean);
  let body: any = null;
  try { if (options.body) { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } } catch {}

  try {
    // ---- Market ----
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts.length === 2) {
      const q = (params.get('q') || '').toLowerCase();
      const catalog = await getCatalog();
      const filtered = q ? catalog.filter((s: any) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : catalog;
      const slice = filtered.slice(0, parseInt(params.get('limit') || '5000'));
      const withPrices = params.get('withprices') === '1';
      if (withPrices && slice.length > 0) {
        const quotes = await getQuotesBulk(slice.map((s: any) => s.symbol));
        return makeResponse(slice.map((s: any) => {
          const qt = quotes.get(s.symbol);
          return { ...s, price: qt?.price ?? null, change: qt?.change ?? 0, changePercent: qt?.changePercent ?? 0 };
        }));
      }
      return makeResponse(slice.map((s: any) => ({ ...s, price: null, change: 0, changePercent: 0 })));
    }
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts[2] && parts[3] === 'history') {
      return makeResponse(await getHistory(parts[2], parseInt(params.get('days') || '30')));
    }
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts[2] === 'search') {
      const q = (params.get('q') || '').toLowerCase();
      const catalog = await getCatalog();
      const matches = catalog.filter((s: any) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 50);
      const quotes = await getQuotesBulk(matches.map((s: any) => s.symbol));
      return makeResponse(matches.map((s: any) => {
        const qt = quotes.get(s.symbol);
        return { ...s, price: qt?.price ?? null, change: qt?.change ?? 0, changePercent: qt?.changePercent ?? 0 };
      }));
    }
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts[2] && parts.length === 3) {
      const symbol = decodeURIComponent(parts[2]).trim();
      const catalog = await getCatalog();
      const listed = catalog.find((x: any) => x.symbol.toLowerCase() === symbol.toLowerCase());
      const s = listed || { name: symbol, sector: '' };
      const q = await getQuote(symbol, s.name, s.sector);
      const exchange = q.exchange === 'NSI' ? 'NSE' : q.exchange === 'BSE' ? 'BSE' : q.exchange;
      return makeResponse({
        ...q,
        name: listed ? s.name : (q.price != null && q.providerName ? q.providerName : s.name),
        sector: listed ? s.sector : (q.price != null && q.providerName ? '' : ''),
        inCatalog: !!listed,
        change_amount: q.change,
        change_percent: q.changePercent,
        data_status: q.price != null ? 'LIVE' : 'UNAVAILABLE',
        exchange,
        high: q.dayHigh ?? q.price,
        low: q.dayLow ?? q.price,
        open: q.previousClose ?? q.price,
        previous_close: q.previousClose ?? q.price,
        volume: q.volume ?? undefined,
        fifty_two_week_high: q.fiftyTwoWeekHigh ?? undefined,
        fifty_two_week_low: q.fiftyTwoWeekLow ?? undefined,
        market_cap: undefined,
        pe_ratio: undefined,
        dividend_yield: undefined,
        description: '',
      });
    }

    // ---- Portfolio ----
    if (parts[0] === 'portfolio' && parts[1] === 'portfolio' && parts.length === 2 && method === 'GET') {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      const [portfolio, holdings] = await Promise.all([getPortfolio(u), getHoldings(u)]);
      const catalog = await getCatalog();
      const holdList = Array.isArray(holdings) ? holdings : [];
      const quotes = holdList.length > 0 ? await getQuotesBulk(holdList.map((h: any) => h.symbol)) : new Map();
      const holdingsWithPrice = holdList.map((h: any) => {
        const cat = catalog.find((c: any) => c.symbol === h.symbol) || { sector: '' };
        const avgPrice = h.avgPurchasePrice || 0;
        const quote = quotes.get(h.symbol);
        const currentPrice = quote?.price ?? Number.isFinite(avgPrice) ? avgPrice : 0;
        const currentValue = h.quantity * currentPrice;
        const profitLoss = currentValue - h.quantity * avgPrice;
        return { ...h, sector: cat.sector, currentPrice, currentValue, profitLoss, profitLossPercent: avgPrice ? (profitLoss / (h.quantity * avgPrice)) * 100 : 0 };
      });
      const totalInvested = holdingsWithPrice.reduce((a: number, h: any) => a + h.avgPurchasePrice * h.quantity, 0);
      const totalHoldingsValue = holdingsWithPrice.reduce((a: number, h: any) => a + h.currentValue, 0);
      const totalProfitLoss = holdingsWithPrice.reduce((a: number, h: any) => a + h.profitLoss, 0);
      return makeResponse({ cashBalance: portfolio.cashBalance, portfolioValue: portfolio.cashBalance + totalHoldingsValue, totalHoldingsValue, totalProfitLoss, totalInvested, holdings: holdingsWithPrice });
    }
    if (parts[0] === 'portfolio' && (parts[1] === 'buy' || parts[1] === 'sell') && parts.length === 2 && method === 'POST') {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      if (!body.symbol || !body.quantity || !body.price) return errResponse('symbol, quantity and price are required.', 400);
      const cat = await getCatalog();
      const listed = cat.find(x => x.symbol === body.symbol);
      const tradeName = (body.name && String(body.name).trim()) || listed?.name || body.symbol;
      const result = await executeTrade(u, { type: parts[1], symbol: body.symbol, name: tradeName, quantity: body.quantity, price: body.price });
      return makeResponse(result);
    }
    if (parts[0] === 'portfolio' && parts[1] === 'transactions' && parts.length === 2) {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      return makeResponse(await getTransactions(u, parseInt(params.get('limit') || '100')));
    }

    // ---- Watchlist ----
    if (parts[0] === 'watchlist' && parts.length === 1 && method === 'GET') {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      const wl = await getWatchlist(u);
      const quotes = await getQuotesBulk(wl.map((w: any) => w.symbol));
      return makeResponse(wl.map((w: any) => {
        const q = quotes.get(w.symbol);
        return { ...w, price: q?.price ?? null, changePercent: q?.changePercent ?? 0, change: q?.change ?? 0 };
      }));
    }
    if (parts[0] === 'watchlist' && parts.length === 2 && method === 'POST') {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      if (parts[1] === 'add') {
        const cat = await getCatalog();
        const listed = cat.find((x: any) => x.symbol === body.symbol);
        const name = (body.name && String(body.name).trim()) || listed?.name || body.symbol;
        await addToWatchlist(u, { symbol: body.symbol, name });
        return makeResponse({ success: true });
      }
      if (parts[1] === 'remove') { await removeFromWatchlist(u, body.symbol); return makeResponse({ success: true }); }
    }

    // ---- Auth session ----
    if (parts[0] === 'auth' && parts[1] === 'session' && parts.length === 2) {
      if (method === 'POST') {
        const u = auth?.currentUser;
        if (!u) return errResponse('Not signed in.', 401);
        const [profile, portfolio] = await Promise.all([getProfile(u.uid), getPortfolio(u.uid)]);
        const fallbackName = (body?.name && String(body.name).trim()) || profile.name || u.displayName || '';
        return makeResponse({
          user: {
            id: u.uid, uid: u.uid, email: u.email ?? profile.email ?? '',
            name: fallbackName, avatarUrl: null,
            cashBalance: portfolio.cashBalance,
            createdAt: u.metadata?.creationTime || new Date().toISOString(),
            token: await u.getIdToken(),
          },
        });
      }
    }

    // ---- Profile ----
    if (parts[0] === 'user' && parts[1] === 'profile' && parts.length === 2) {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      if (method === 'GET') {
        const profile = await getProfile(u);
        const [cash, txs] = await Promise.all([getPortfolio(u), getTransactions(u).then(t => t.length)]);
        const created = auth?.currentUser?.metadata?.creationTime || new Date().toISOString();
        return makeResponse({ id: u, name: profile.name, email: auth?.currentUser?.email ?? profile.email ?? '', avatarUrl: null, cashBalance: cash.cashBalance, createdAt: created, stats: { transactions: txs, achievements: 0, lessonsCompleted: 0 } });
      }
      if (method === 'POST' || method === 'PUT') { await saveProfile(u, { name: body.name }); return makeResponse({ success: true }); }
    }

    // ---- AI teacher (client-side Groq) ----
    if (parts[0] === 'ai') {
      if (parts[1] === 'status') return makeResponse(getStatus());
      if (parts[1] === 'history') return makeResponse(getHistoryData());
      if (parts[1] === 'clear' && method === 'POST') return makeResponse(await clearHistory());
      if (parts[1] === 'chat' && method === 'POST') return makeResponse(await groqChat(body.message));
    }

    // ---- Learn (placeholder) ----
    if (parts[0] === 'learn' && parts[1] === 'lessons' && parts.length === 2) return makeResponse([]);
    if (parts[0] === 'learn' && parts[1] === 'achievements' && parts.length === 2) return makeResponse([]);
    if (parts[0] === 'learn' && parts[1] === 'lessons' && parts[2] && parts.length === 3) return makeResponse({ slug: parts[2], content: '', questions: [] });
    if (parts[0] === 'learn' && parts[1] === 'quiz' && parts[2] === 'submit') return makeResponse({ score: 0 });

    return errResponse('Not found.', 404);
  } catch (err: any) {
    return errResponse(err?.message || 'Server error.', 500);
  }
}
