const PROXY = import.meta.env.VITE_MARKET_PROXY || '';
const AV_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || '';

interface DailySeries {
  [date: string]: { '4. close': string };
}

async function avTimeSeries(symbol: string): Promise<DailySeries | null> {
  if (!AV_KEY) return null;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${AV_KEY}`;
  try {
    const r = await fetch(url, { headers: { Origin: 'https://a.com', 'User-Agent': 'Mozilla/5.0' } });
    const j = await r.json();
    return (j['Time Series (Daily)'] as DailySeries) ?? null;
  } catch {
    return null;
  }
}

async function yahooChart(symbol: string, days: number): Promise<{ date: string; price: number }[]> {
  const range = days <= 5 ? '5d' : days <= 30 ? '1mo' : '3mo';
  const url = PROXY
    ? `${PROXY}?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`)}`
    : `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36', Origin: 'https://avenix-stocklab.web.app' } });
    if (!r.ok) return [];
    const j = await r.json();
    const res = j.chart?.result?.[0];
    if (!res) return [];
    const timestamps = (res.timestamp as number[]) || [];
    const closes = (res.indicators?.quote?.[0]?.close as number[]) || [];
    const out: { date: string; price: number }[] = [];
    for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
      out.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), price: closes[i] });
    }
    return out;
  } catch {
    return [];
  }
}

export interface MarketQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  change: number;
  changePercent: number;
}

export async function getCatalog(): Promise<{ symbol: string; name: string; sector: string }[]> {
  try {
    const r = await fetch('/stocks.json');
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export async function getQuote(symbol: string, name: string, sector: string): Promise<MarketQuote> {
  const history = await yahooChart(symbol, 2);
  if (history.length >= 2) {
    const price = history[history.length - 1].price;
    const prev = history[history.length - 2].price;
    return { symbol, name, sector, price, change: price - prev, changePercent: prev ? ((price - prev) / prev) * 100 : 0 };
  }
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
  return { symbol, name, sector, price: null, change: 0, changePercent: 0 };
}

export async function getHistory(symbol: string, days = 30): Promise<{ date: string; price: number }[]> {
  const hist = await yahooChart(symbol, days);
  if (hist.length > 0) return hist;
  const series = await avTimeSeries(symbol);
  if (series) {
    const dates = Object.keys(series).sort().slice(-days);
    return dates.map(d => ({ date: d, price: parseFloat(series[d]['4. close']) }));
  }
  return [];
}
