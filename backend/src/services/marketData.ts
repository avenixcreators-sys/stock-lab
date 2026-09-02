import db from '../database.js';
import type { MarketDataProvider } from './providers/index.js';
import { createMarketDataProvider, isMarketDataConfigured } from './providers/index.js';

interface MarketQuote {
  symbol: string;
  price: number | null;
  change: number;
  changePercent: number;
  volume: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  status: 'LIVE' | 'DELAYED' | 'CACHED' | 'UNAVAILABLE';
  quoteTime?: string | null;
}

interface HistoricalPoint {
  date: string;
  price: number;
  volume?: number | null;
}

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 60s local read cache

/**
 * Per-symbol external refresh guard. A symbol is only hit on the provider at
 * most once per REFRESH_MS (default 1h) — critical for Alpha Vantage's 25
 * req/day free tier. It is refreshed when a user actually views it.
 */
const REFRESH_MS = 60 * 60 * 1000;
const refreshing = new Map<string, boolean>();
const lastRefreshed = new Map<string, number>();

let providerInstance: MarketDataProvider | null = null;

function getProvider(): MarketDataProvider | null {
  if (!isMarketDataConfigured()) return null;
  if (!providerInstance) providerInstance = createMarketDataProvider();
  return providerInstance;
}

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getLatestRow(symbol: string): any {
  return db
    .prepare(`SELECT * FROM market_data WHERE symbol = ? ORDER BY id DESC LIMIT 1`)
    .get(symbol);
}

function stockRow(symbol: string): any {
  return db.prepare('SELECT * FROM stocks WHERE symbol = ?').get(symbol);
}

function nowIso(): string {
  return new Date().toISOString();
}

function providerSymbolFor(stock: any): string | null {
  if (!stock) return null;
  return stock.provider_symbol || stock.symbol || null;
}

function splitProviderSymbol(providerSymbol: string): string {
  const parts = providerSymbol.split('.');
  return parts[0].split(':')[0];
}

function localSymbolForProviderSymbol(providerSymbol: string): string | null {
  const row: any = db.prepare('SELECT symbol FROM stocks WHERE provider_symbol = ? LIMIT 1').get(providerSymbol);
  return row ? row.symbol : null;
}

/** Persist a freshly fetched (legitimate) quote into market_data + stock status. */
function storeQuote(
  symbol: string,
  q: {
    price: number;
    change?: number | null;
    changePercent?: number | null;
    volume?: number | null;
    open?: number | null;
    high?: number | null;
    low?: number | null;
    previousClose?: number | null;
    status: string;
    quoteTime?: string | null;
  }
): void {
  db.prepare(
    `INSERT INTO market_data (symbol, price, change_amount, change_percent, volume, high, low, open, previous_close, timestamp, data_status, quote_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    symbol,
    q.price,
    q.change ?? 0,
    q.changePercent ?? 0,
    q.volume ?? null,
    q.high ?? null,
    q.low ?? null,
    q.open ?? null,
    q.previousClose ?? null,
    nowIso(),
    q.status,
    q.quoteTime || null
  );

  db.prepare(
    `UPDATE stocks SET last_market_data_at = ?, data_status = ?, last_updated = datetime('now') WHERE symbol = ?`
  ).run(q.quoteTime || nowIso(), q.status, symbol);

  cache.delete(`quote:${symbol}`);
  cache.delete('quotes:all');
}

/**
 * Resolve the latest legitimate quote for a symbol.
 *
 * Returns the last known legitimate stored value immediately (never blocks on
 * the network). When a provider is configured and the symbol hasn't been
 * refreshed recently, an async refresh is triggered in the background so the
 * next read picks up real fresh data. No price is ever fabricated.
 */
export function getQuote(symbol: string): MarketQuote | null {
  const upper = symbol.toUpperCase();
  const cached = getCached(`quote:${upper}`);
  if (cached) return cached;

  const row = getLatestRow(upper);
  const stock = stockRow(upper);

  // Not a known stock: there's no instrument and nothing to quote.
  if (!row && !stock) return null;

  let status = stock?.data_status || row?.data_status;
  if (!status) status = row ? 'CACHED' : 'UNAVAILABLE';

  const quote: MarketQuote = row
    ? {
        symbol: upper,
        price: row.price,
        change: row.change_amount ?? 0,
        changePercent: row.change_percent ?? 0,
        volume: row.volume ?? null,
        high: row.high ?? null,
        low: row.low ?? null,
        open: row.open ?? null,
        previousClose: row.previous_close ?? null,
        status,
        quoteTime: row.quote_time || row.timestamp || null,
      }
    : {
        symbol: upper,
        price: null,
        change: 0,
        changePercent: 0,
        volume: null,
        high: null,
        low: null,
        open: null,
        previousClose: null,
        status: 'UNAVAILABLE',
      };

  const provider = getProvider();
  const psym = providerSymbolFor(stock);
  if (provider && psym) {
    maybeRefresh(upper, psym, provider);
  }

  setCache(`quote:${upper}`, quote);
  return quote;
}

/** Fire-and-forget refresh bounded by REFRESH_MS + a refresh-in-progress guard. */
function maybeRefresh(symbol: string, providerSymbol: string, provider: MarketDataProvider): void {
  const last = lastRefreshed.get(symbol) || 0;
  if (Date.now() - last < REFRESH_MS) return;
  if (refreshing.get(symbol)) return;
  refreshing.set(symbol, true);
  lastRefreshed.set(symbol, Date.now());

  provider
    .getQuote(providerSymbol)
    .then(q => {
      if (q) {
        storeQuote(symbol, { ...q, status: q.status });
      }
    })
    .catch(e => console.error(`Quote refresh failed for ${symbol}:`, (e as Error).message))
    .finally(() => refreshing.delete(symbol));
}

/**
 * All quotes with pagination. Local-first; no external call on list views.
 */
export function getAllQuotes(limit = 100, offset = 0): any[] {
  const cached = getCached('quotes:all');
  if (cached) return cached.slice(offset, offset + limit);

  const rows = db
    .prepare(
      `SELECT s.symbol, s.name, s.sector, s.exchange, s.data_status, s.currency, s.country,
              md.price, md.change_amount, md.change_percent, md.volume, md.high, md.low, md.open, md.previous_close,
              md.quote_time
       FROM stocks s
       LEFT JOIN market_data md ON md.id = (SELECT MAX(m2.id) FROM market_data m2 WHERE m2.symbol = s.symbol)
       WHERE s.provider IS NOT NULL OR md.id IS NOT NULL
       ORDER BY s.symbol`
    )
    .all() as any[];

  const quotes = rows.map(r => ({
    symbol: r.symbol,
    name: r.name,
    sector: r.sector,
    exchange: r.exchange,
    currency: r.currency,
    country: r.country,
    data_status: r.data_status || (r.price != null ? 'CACHED' : 'UNAVAILABLE'),
    price: r.price,
    change: r.change_amount,
    changePercent: r.change_percent,
    volume: r.volume,
    high: r.high,
    low: r.low,
    open: r.open,
    previousClose: r.previous_close,
  }));

  setCache('quotes:all', quotes);
  return quotes.slice(offset, offset + limit);
}

function relevanceScore(row: { symbol: string; name: string }, query: string): number {
  const symbol = row.symbol.toUpperCase();
  const name = row.name.toUpperCase();
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (symbol.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return 5;
}

const MIN_SEARCH_LENGTH = 2;

function mapRow(r: any) {
  return {
    symbol: r.symbol,
    name: r.name,
    sector: r.sector,
    exchange: r.exchange,
    currency: r.currency,
    country: r.country,
    data_status: r.data_status || (r.price != null ? 'CACHED' : 'UNAVAILABLE'),
    price: r.price,
    change: r.change_amount,
    changePercent: r.change_percent,
    volume: r.volume,
    high: r.high,
    low: r.low,
    open: r.open,
    previousClose: r.previous_close,
  };
}

/**
 * Stock discovery + search.
 *
 * 1. Search local database first (fast, no network).
 * 2. Only if there are no local matches and the query is long enough, call the
 *    provider (when configured), auto-add valid instruments (deduped), and fetch
 *    their latest legitimate quote. Newly discovered stocks are returned in the
 *    same search response so they are immediately usable.
 *
 * External discovery is cached for 1 hour so we never hit the provider per keystroke.
 */
export async function searchStocks(query: string, limit = 20, offset = 0): Promise<any[]> {
  const q = (query || '').trim().toUpperCase();
  if (!q) return [];

  const local = function (): any[] {
    const rows = db
      .prepare(
        `SELECT s.symbol, s.name, s.sector, s.exchange, s.data_status, s.currency, s.country,
                md.price, md.change_amount, md.change_percent, md.volume, md.high, md.low, md.open, md.previous_close
         FROM stocks s
         LEFT JOIN market_data md ON md.id = (SELECT MAX(m2.id) FROM market_data m2 WHERE m2.symbol = s.symbol)
         WHERE UPPER(s.symbol) LIKE '%' || ? || '%'
            OR UPPER(s.name) LIKE '%' || ? || '%'
            OR UPPER(s.sector) LIKE '%' || ? || '%'
            OR (s.exchange IS NOT NULL AND UPPER(s.exchange) LIKE '%' || ? || '%')
         ORDER BY s.symbol`
      )
      .all(q, q, q, q) as any[];
    return rows
      .map(mapRow)
      .sort((a, b) => {
        const sa = relevanceScore({ symbol: a.symbol, name: a.name }, q);
        const sb = relevanceScore({ symbol: b.symbol, name: b.name }, q);
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      })
      .slice(offset, offset + limit);
  };

  const before = local();
  if (before.length > 0) {
    return before;
  }

  // No local hits: provider discovery (only when configured and query long enough).
  if (q.length >= MIN_SEARCH_LENGTH) {
    await discoverAndAdd(query.trim());
  }

  const after = local();
  // If nothing was discovered, also match by provider symbol text for discovered aliases.
  return after.length > 0 ? after : local();
}

/** Query provider for discovery, validate, and add legitimately discoverable instruments. */
async function discoverAndAdd(query: string): Promise<void> {
  const provider = getProvider();
  if (!provider) return;

  const q = query.trim();
  const key = `discovery:${q}`;
  if (getCached(key)) return;
  // Mark now so concurrent calls during the network round-trip are deduped.
  cache.set(key, { data: true, timestamp: Date.now() - CACHE_TTL + 3600_000 });

  try {
    const instruments = await provider.searchInstruments(q);
    // Drop obviously non-equity instruments (ETF/fund/index) when the provider labels them.
    const equities = instruments.filter(inst => {
      const t = (inst.assetType || '').toLowerCase();
      if (!t) return true;
      return !(t.includes('etf') || t.includes('fund') || t.includes('index') || t.includes('mutual'));
    });
    // Fetch quotes for discovered instruments so they're immediately tradeable.
    await Promise.all(
      equities.slice(0, 5).map(async inst => {
        const sym = addInstrument(inst);
        if (sym) await fetchQuoteNow(sym);
      })
    );
  } catch (e) {
    console.error('Provider discovery failed:', (e as Error).message);
  }
}

/** Insert a discovered instrument if not already present (dedupe on provider + provider_symbol). Returns the local symbol, or null if skipped. */
function addInstrument(inst: {
  provider: string;
  providerSymbol: string;
  name: string;
  exchange?: string;
  country?: string;
  assetType?: string;
  currency?: string;
}): string | null {
  const existing: any = db
    .prepare('SELECT symbol FROM stocks WHERE provider = ? AND provider_symbol = ?')
    .get(inst.provider, inst.providerSymbol);
  if (existing) return existing.symbol;

  // Also map an already-present provider symbol under a different local name.
  const alias = localSymbolForProviderSymbol(inst.providerSymbol);
  if (alias) return alias;

  const symbol = deriveLocalSymbol(inst.providerSymbol);
  // Guard against overwriting a distinct existing symbol.
  if (db.prepare('SELECT symbol FROM stocks WHERE symbol = ?').get(symbol)) {
    return null;
  }

  db.prepare(
    `INSERT INTO stocks (symbol, name, exchange, provider, provider_symbol, country, currency, asset_type, data_status, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNAVAILABLE', datetime('now'))`
  ).run(
    symbol,
    inst.name,
    inst.exchange && inst.exchange !== 'United States' ? inst.exchange : 'US',
    inst.provider,
    inst.providerSymbol,
    inst.country || null,
    inst.currency || null,
    inst.assetType || null
  );

  return symbol;
}

/** One-time awaited quote fetch/store (used when a stock is freshly discovered). */
async function fetchQuoteNow(localSymbol: string): Promise<void> {
  const stock = stockRow(localSymbol);
  const provider = getProvider();
  const psym = providerSymbolFor(stock);
  if (!provider || !psym) return;
  try {
    const q = await provider.getQuote(psym);
    if (q) {
      storeQuote(localSymbol, { ...q, status: q.status });
      lastRefreshed.set(localSymbol, Date.now());
    }
  } catch (e) {
    console.error(`Quote fetch failed for ${localSymbol}:`, (e as Error).message);
  }
}

function deriveLocalSymbol(providerSymbol: string): string {
  const base = splitProviderSymbol(providerSymbol) || providerSymbol;
  const clean = base.toUpperCase().replace(/[^A-Z0-9._-]/g, '');
  return clean || `SYM_${Math.floor(Math.random() * 1e9)}`;
}

/** Stock details with its latest legitimate quote and data status. */
export function getStockDetails(symbol: string): any | null {
  const row = stockRow(symbol.toUpperCase());
  if (!row) return null;
  const quote = getQuote(symbol.toUpperCase());
  return {
    ...row,
    price: quote?.price ?? row.price ?? null,
    change_amount: quote?.change ?? row.change_amount ?? 0,
    change_percent: quote?.changePercent ?? row.change_percent ?? 0,
    volume: quote?.volume ?? row.volume ?? null,
    high: quote?.high ?? row.high ?? null,
    low: quote?.low ?? row.low ?? null,
    open: quote?.open ?? row.open ?? null,
    previous_close: quote?.previousClose ?? row.previous_close ?? null,
    data_status: quote?.status || row.data_status || 'UNAVAILABLE',
  };
}

/**
 * Fetch legitimate historical data from the provider for chart display.
 * If unavailable, returns an empty array (UI shows "Historical data unavailable").
 * Never synthesizes prices.
 */
export async function getHistoricalData(symbol: string, days: number): Promise<HistoricalPoint[]> {
  const upper = symbol.toUpperCase();
  const stock = stockRow(upper);
  if (!stock) return [];

  const stored = readHistory(upper, days);
  if (stored.length >= days) {
    return stored;
  }

  const provider = getProvider();
  const psym = providerSymbolFor(stock);
  if (provider && psym) {
    try {
      const result = await provider.getHistoricalData(psym, days);
      if (result.status === 'HISTORICAL' && result.points.length) {
        storeHistory(upper, result.points, result.provider);
      }
    } catch (e) {
      console.error(`History refresh failed for ${upper}:`, (e as Error).message);
    }
  }

  return readHistory(upper, days);
}

/** Read persisted history for a symbol, most recent first, up to `days` rows. */
function readHistory(symbol: string, days: number): HistoricalPoint[] {
  const rows = db
    .prepare(
      'SELECT date, price, volume FROM price_history WHERE symbol = ? ORDER BY date DESC LIMIT ?'
    )
    .all(symbol, days) as any[];
  return rows
    .map(r => ({ date: r.date, price: r.price as number, volume: (r.volume as number) ?? null }))
    .reverse();
}

/** Persist provider historical points (deduped on symbol + date). */
function storeHistory(symbol: string, points: HistoricalPoint[], source: string): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO price_history (symbol, date, price, volume, source)
     VALUES (@symbol, @date, @price, @volume, @source)`
  );
  const run = db.transaction((pts: HistoricalPoint[]) => {
    for (const p of pts) {
      insert.run({ symbol, date: p.date, price: p.price, volume: p.volume ?? null, source });
    }
  });
  run(points);
}

export const marketDataStatus = {
  LIVE: 'LIVE',
  DELAYED: 'DELAYED',
  CACHED: 'CACHED',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
