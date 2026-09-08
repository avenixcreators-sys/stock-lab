const PROXY = import.meta.env.VITE_MARKET_PROXY || '';
const AV_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || '';
import catalogData from '../data/catalog.json';

export interface CatalogEntry {
  symbol: string;
  name: string;
  sector: string;
}

export function getCatalogSync(): CatalogEntry[] {
  return catalogData as CatalogEntry[];
}

interface DailySeries {
  [date: string]: { '4. close': string };
}

async function fetchJson(target: string): Promise<any | null> {
  const url = PROXY ? `${PROXY}?url=${encodeURIComponent(target)}` : target;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    return null;
  }
}

async function avTimeSeries(symbol: string): Promise<DailySeries | null> {
  if (!AV_KEY) return null;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${AV_KEY}`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (!j || j['Information'] || j['Note']) return null;
    return (j['Time Series (Daily)'] as DailySeries) ?? null;
  } catch {
    return null;
  }
}

async function yahooChart(symbol: string, days: number): Promise<{ date: string; price: number }[]> {
  const range = days <= 5 ? '5d' : days <= 30 ? '1mo' : '3mo';
  const yahooSym = symbol.includes('.') ? symbol : `${symbol}.NS`;
  const target = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=${range}`;
  const j = await fetchJson(target);
  const res = j?.chart?.result?.[0];
  if (!res) return [];
  const timestamps = (res.timestamp as number[]) || [];
  const closes = (res.indicators?.quote?.[0]?.close as number[]) || [];
  const out: { date: string; price: number }[] = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
    out.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), price: closes[i] });
  }
  return out;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  change: number;
  changePercent: number;
  providerName?: string;
  currency?: string;
  exchange?: string;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  volume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface BulkQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  providerName?: string;
  currency?: string;
  exchange?: string;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  volume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export async function getQuotesBulk(symbols: string[]): Promise<Map<string, BulkQuote>> {
  const out = new Map<string, BulkQuote>();
  const unique = Array.from(new Set(symbols.map(s => s.trim()).filter(Boolean))).slice(0, 200);
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const dot = chunk.map(s => (s.includes('.') ? s : `${s}.NS`));
    const target = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(dot.join(','))}&range=1d&interval=5m`;
    const j = await fetchJson(target);
    const results = (j?.spark?.result as any[]) || [];
    for (const res of results) {
      const meta = res.response?.[0]?.meta;
      const price = meta ? parseFloat(meta.regularMarketPrice) : NaN;
      if (!meta || isNaN(price)) continue;
      const bare = String(res.symbol).replace(/\.NS$/i, '');
      out.set(bare, {
        symbol: bare,
        price,
        change: meta.fulldayChange ?? meta.regularMarketChange ?? 0,
        changePercent: meta.fulldayChangePercent ?? meta.regularMarketChangePercent ?? 0,
        providerName: meta.shortName ?? undefined,
        currency: meta.currency ?? undefined,
        exchange: meta.fullExchangeName ?? meta.exchangeName ?? undefined,
        dayHigh: meta.regularMarketDayHigh ?? undefined,
        dayLow: meta.regularMarketDayLow ?? undefined,
        previousClose: meta.previousClose ?? meta.chartPreviousClose ?? undefined,
        volume: meta.regularMarketVolume ?? undefined,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? undefined,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? undefined,
      });
    }
    await new Promise(res => setTimeout(res, 350));
  }
  return out;
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  return getCatalogSync();
}

export async function getQuote(symbol: string, name: string, sector: string): Promise<MarketQuote> {
  const series = await avTimeSeries(symbol);
  if (series) {
    const dates = Object.keys(series);
    if (dates.length > 0) {
      const latest = dates[0];
      const price = parseFloat(series[latest]['4. close']);
      const prev = dates[1] ? parseFloat(series[dates[1]]['4. close']) : price;
      return { symbol, name, sector, price, change: price - prev, changePercent: prev ? ((price - prev) / prev) * 100 : 0 };
    }
  }
  if (PROXY) {
    const quotes = await getQuotesBulk([symbol]);
    const q = quotes.get(symbol);
    if (q) return {
      symbol, name, sector, price: q.price, change: q.change, changePercent: q.changePercent,
      providerName: q.providerName, currency: q.currency, exchange: q.exchange, dayHigh: q.dayHigh,
      dayLow: q.dayLow, previousClose: q.previousClose, volume: q.volume,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh, fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    };
    const history = await yahooChart(symbol, 2);
    if (history.length >= 2) {
      const price = history[history.length - 1].price;
      const prev = history[history.length - 2].price;
      return { symbol, name, sector, price, change: price - prev, changePercent: prev ? ((price - prev) / prev) * 100 : 0 };
    }
  }
  return { symbol, name, sector, price: null, change: 0, changePercent: 0 };
}

export async function getHistory(symbol: string, days = 30): Promise<{ date: string; price: number }[]> {
  const series = await avTimeSeries(symbol);
  if (series) {
    const dates = Object.keys(series).sort().slice(-days);
    return dates.map(d => ({ date: d, price: parseFloat(series[d]['4. close']) }));
  }
  if (PROXY) {
    const hist = await yahooChart(symbol, days);
    if (hist.length > 0) return hist;
  }
  return [];
}
