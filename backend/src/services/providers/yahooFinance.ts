import type {
  MarketDataProvider,
  DiscoveredInstrument,
  Quote,
  HistoricalResult,
} from './types.js';

/**
 * Yahoo Finance provider (server-side only, free, no API key).
 *
 * Pulls real historical daily prices for NSE `.NS` symbols via Yahoo's public
 * chart endpoint (query1.finance.yahoo.com/v8/finance/chart). Alpha Vantage is
 * used for quote/search, but its free tier returns NO daily history for `.NS`
 * symbols, so this provider backs the history feature for NSE stocks.
 *
 * Yahoo symbols mirror our provider symbols directly (e.g. TCS.NS, RELIANCE.NS).
 */

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

const RANGES: Array<[number, string]> = [
  [1, '1d'],
  [5, '5d'],
  [30, '1mo'],
  [90, '3mo'],
  [180, '6mo'],
  [365, '1y'],
  [730, '2y'],
  [1825, '5y'],
];

function rangeForDays(days: number): string {
  const safe = Math.max(1, Math.floor(days));
  for (const [max, range] of RANGES) {
    if (safe <= max) return range;
  }
  return '10y';
}

const num = (v: any): number | null => {
  const n = Number(v);
  return v !== null && v !== undefined && !Number.isNaN(n) ? n : null;
};

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = 'yahoo_finance';

  /** Free public endpoint — no key required, always usable. */
  isConfigured(): boolean {
    return true;
  }

  private async chart(providerSymbol: string, range: string): Promise<any[]> {
    const url = CHART_BASE + encodeURIComponent(providerSymbol) + '?range=' + range + '&interval=1d';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (StockLab educational simulator)' },
    });
    if (!res.ok) throw new Error(`Yahoo Finance chart failed with status ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      const code = data?.chart?.error?.code;
      const desc = data?.chart?.error?.description;
      throw new Error(`Yahoo Finance returned no data for ${providerSymbol}: ${code} ${desc}`.trim());
    }
    return [result, data];
  }

  async searchInstruments(query: string): Promise<DiscoveredInstrument[]> {
    // Discovery is handled by Alpha Vantage; Yahoo is used for history/quotes only.
    return [];
  }

  async getQuote(providerSymbol: string): Promise<Quote | null> {
    if (!providerSymbol) return null;
    try {
      const [res] = await this.chart(providerSymbol, '1d');
      const meta = res?.meta || {};
      const price = num(meta['regularMarketPrice']);
      if (price === null) return null;

      const q = res?.indicators?.quote?.[0] || {};
      const last = (arr: any) => {
        const a = Array.isArray(arr) ? arr : [];
        return a.length ? a[a.length - 1] : null;
      };

      return {
        provider: this.name,
        providerSymbol,
        price,
        changeAmount: num(meta['regularMarketChange']),
        changePercent: num(meta['regularMarketChangePercent']),
        volume: num(meta['regularMarketVolume']) ?? num(last(q.volume)),
        open: num(meta['regularMarketOpen']) ?? num(last(q.open)),
        high: num(meta['regularMarketDayHigh']) ?? num(last(q.high)),
        low: num(meta['regularMarketDayLow']) ?? num(last(q.low)),
        previousClose: num(meta['chartPreviousClose']) ?? num(meta['previousClose']),
        quoteTime: num(meta['regularMarketTime'])
          ? new Date(Number(meta['regularMarketTime']) * 1000).toISOString()
          : null,
        status: 'DELAYED',
      };
    } catch (e) {
      return null;
    }
  }

  async getHistoricalData(providerSymbol: string, days: number): Promise<HistoricalResult> {
    if (!providerSymbol) {
      return { provider: this.name, providerSymbol, points: [], status: 'UNAVAILABLE' };
    }
    try {
      const [res] = await this.chart(providerSymbol, rangeForDays(days));
      const timestamps: number[] = Array.isArray(res?.timestamp) ? res.timestamp : [];
      const q = res?.indicators?.quote?.[0] || {};
      const closes: any[] = Array.isArray(q.close) ? q.close : [];
      const opens: any[] = Array.isArray(q.open) ? q.open : [];
      const highs: any[] = Array.isArray(q.high) ? q.high : [];
      const lows: any[] = Array.isArray(q.low) ? q.low : [];
      const volumes: any[] = Array.isArray(q.volume) ? q.volume : [];

      const points = timestamps
        .map((ts, i) => {
          const price = num(closes[i]);
          if (price === null || price === 0) return null;
          return {
            date: new Date(ts * 1000).toISOString().slice(0, 10),
            price,
            open: num(opens[i]),
            high: num(highs[i]),
            low: num(lows[i]),
            volume: num(volumes[i]),
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-days);

      return {
        provider: this.name,
        providerSymbol,
        points,
        status: points.length ? 'HISTORICAL' : 'UNAVAILABLE',
      };
    } catch (e) {
      return { provider: this.name, providerSymbol, points: [], status: 'UNAVAILABLE' };
    }
  }
}
