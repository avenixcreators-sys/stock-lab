import { getCatalog, getQuote, getHistory } from '../services/marketData';
import {
  getPortfolio, getHoldings, getTransactions, getWatchlist,
  addToWatchlist, removeFromWatchlist, executeTrade, getProfile, saveProfile,
} from '../services/firestore';
import { auth } from '../firebase';

function makeResponse(data: any, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return data; } };
}
function errResponse(message: string, status = 400) {
  return makeResponse({ error: message }, status);
}
function uid() { return auth?.currentUser?.uid ?? null; }

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e8) return `₹${(n / 1e8).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e6) return `₹${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e4) return `₹${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
}
export function formatPercent(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const path = url.replace(/^\/api\//, '');
  const [p, ...rest] = path.split('?');
  const params = new URLSearchParams(rest.join('?'));
  const parts = p.split('/').filter(Boolean);
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null;

  try {
    // ---- Market ----
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts.length === 2) {
      const q = (params.get('q') || '').toLowerCase();
      const catalog = await getCatalog();
      const filtered = q ? catalog.filter((s: any) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : catalog;
      const stocks = filtered.slice(0, parseInt(params.get('limit') || '5000')).map((s: any) => ({ ...s, price: null, change: 0, changePercent: 0 }));
      return makeResponse(stocks);
    }
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts[2] && parts[3] === 'history') {
      return makeResponse(await getHistory(parts[1], parseInt(params.get('days') || '30')));
    }
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts[2] && parts.length === 3) {
      const catalog = await getCatalog();
      const s = catalog.find((x: any) => x.symbol === parts[1]) || { name: parts[1], sector: '' };
      return makeResponse(await getQuote(parts[1], s.name, s.sector));
    }
    if (parts[0] === 'market' && parts[1] === 'stocks' && parts[2] === 'search') {
      const q = (params.get('q') || '').toLowerCase();
      const catalog = await getCatalog();
      return makeResponse(catalog.filter((s: any) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 50).map((s: any) => ({ ...s, price: null, change: 0, changePercent: 0 })));
    }

    // ---- Portfolio ----
    if (parts[0] === 'portfolio' && parts[1] === 'portfolio' && parts.length === 2 && method === 'GET') {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      const [portfolio, holdings] = await Promise.all([getPortfolio(u), getHoldings(u)]);
      const holdingsWithPrice = holdings.map((h: any) => ({ ...h, currentValue: h.quantity * (h.avgPurchasePrice || 0), profitLoss: 0 }));
      const totalInvested = holdingsWithPrice.reduce((a: number, h: any) => a + h.avgPurchasePrice * h.quantity, 0);
      const totalHoldingsValue = holdingsWithPrice.reduce((a: number, h: any) => a + h.currentValue, 0);
      return makeResponse({ cashBalance: portfolio.cashBalance, portfolioValue: portfolio.cashBalance + totalHoldingsValue, totalHoldingsValue, totalProfitLoss: portfolio.cashBalance + totalHoldingsValue - totalInvested, totalInvested, holdings: holdingsWithPrice });
    }
    if (parts[0] === 'portfolio' && (parts[1] === 'buy' || parts[1] === 'sell') && parts.length === 2 && method === 'POST') {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      const result = await executeTrade(u, { type: parts[1], symbol: body.symbol, name: body.name, quantity: body.quantity, price: body.price });
      return makeResponse(result);
    }
    if (parts[0] === 'portfolio' && parts[1] === 'transactions' && parts.length === 2) {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      return makeResponse(await getTransactions(u, parseInt(params.get('limit') || '100')));
    }

    // ---- Watchlist ----
    if (parts[0] === 'watchlist' && parts.length === 1) {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
      if (method === 'GET') {
        const wl = await getWatchlist(u);
        const enriched = await Promise.all(wl.map(async (w: any) => { const q = await getQuote(w.symbol, w.name, ''); return { ...w, price: q.price, changePercent: q.changePercent }; }));
        return makeResponse(enriched);
      }
      if (method === 'POST' && parts[1] === 'add') { await addToWatchlist(u, { symbol: body.symbol, name: body.name }); return makeResponse({ success: true }); }
      if (method === 'POST' && parts[1] === 'remove') { await removeFromWatchlist(u, body.symbol); return makeResponse({ success: true }); }
    }

    // ---- Auth session ----
    if (parts[0] === 'auth' && parts[1] === 'session' && parts.length === 2) {
      if (method === 'POST') {
        const u = auth?.currentUser;
        if (!u) return errResponse('Not signed in.', 401);
        const profile = await getProfile(u.uid);
        return makeResponse({ user: { uid: u.uid, email: u.email, name: profile.name, token: await u.getIdToken() } });
      }
    }

    // ---- Profile ----
    if (parts[0] === 'user' && parts[1] === 'profile' && parts.length === 2) {
      const u = uid();
      if (!u) return errResponse('Not authenticated.', 401);
        if (method === 'GET') { return makeResponse({ ...(await getProfile(u)), email: auth?.currentUser?.email ?? '', uid: u, cashBalance: (await getPortfolio(u)).cashBalance }); }
      if (method === 'POST') { await saveProfile(u, { name: body.name }); return makeResponse({ success: true }); }
    }

    // ---- AI teacher (disabled) ----
    if (parts[0] === 'ai') return makeResponse({ enabled: false, message: 'AI Teacher requires a server-side backend (enable with Firebase Cloud Functions).' }, 200);

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
