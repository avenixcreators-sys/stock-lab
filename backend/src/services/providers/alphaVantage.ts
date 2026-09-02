import type {
  MarketDataProvider,
  DiscoveredInstrument,
  Quote,
  HistoricalResult,
} from './types.js';

/**
 * Alpha Vantage provider (server-side only).
 *
 * Uses the public Alpha Vantage REST API. The API key lives ONLY in the
 * backend environment (ALPHA_VANTAGE_API_KEY) and is never exposed to the
 * frontend. Free-tier sandbox limits (25 requests/day) drive aggressive local
 * caching so we do not hit the provider on every request.
 *
 * Endpoints used:
 *   - SYMBOL_SEARCH   -> company/stock discovery
 *   - GLOBAL_QUOTE    -> latest quote
 *   - TIME_SERIES_DAILY -> historical daily prices
 *
 * Requires Node 18+ global fetch.
 */

const BASE = process.env.ALPHA_VANTAGE_BASE_URL || 'https://www.alphavantage.co/query';

interface ProviderConfig {
  apiKey: string;
  /** Optional outbound HTTP rate limit (ms between calls) to stay within free-tier bursts. */
  minIntervalMs?: number;
}

export class AlphaVantageProvider implements MarketDataProvider {
  readonly name = 'alpha_vantage';
  private apiKey: string | undefined;
  private lastCallAt = 0;
  private minIntervalMs: number;

  constructor(apiKey?: string, minIntervalMs = 1000) {
    this.apiKey = apiKey;
    this.minIntervalMs = minIntervalMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async fetch(params: Record<string, string>): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key is not configured on the server.');
    }
    await this.throttle();
    const url = new URL(BASE);
    url.searchParams.set('apikey', this.apiKey);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'StockLab/1.0 (educational simulator)' },
    });
    if (!res.ok) {
      throw new Error(`Alpha Vantage request failed with status ${res.status}`);
    }
    const data = await res.json();
    if (data && data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    if (data && data['Note']) {
      throw new Error(`Alpha Vantage rate limit note: ${data['Note']}`);
    }
    return data;
  }

  /** Minimal spacing between outbound requests to respect free-tier bursts. */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt;
    if (elapsed < this.minIntervalMs) {
      await new Promise(r => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastCallAt = Date.now();
  }

  async searchInstruments(query: string): Promise<DiscoveredInstrument[]> {
    const q = (query || '').trim();
    if (!q) return [];
    const data = await this.fetch({ function: 'SYMBOL_SEARCH', keywords: q });
    const matches: any[] = Array.isArray(data.bestMatches) ? data.bestMatches : [];

    return matches.map(m => ({
      provider: this.name,
      providerSymbol: m['1. symbol'],
      name: m['2. name'],
      assetType: m['3. type'] || undefined,
      country: m['4. region'] || undefined,
      currency: m['8. currency'] || undefined,
    }));
  }

  async getQuote(providerSymbol: string): Promise<Quote | null> {
    if (!providerSymbol) return null;
    const data = await this.fetch({ function: 'GLOBAL_QUOTE', symbol: providerSymbol });
    const g = data?.['Global Quote'];
    if (!g) return null;

    const num = (v: any): number | null => {
      const n = Number(v);
      return v !== null && v !== undefined && !Number.isNaN(n) ? n : null;
    };

    const price = num(g['05. price']);
    if (price === null) return null;

    return {
      provider: this.name,
      providerSymbol,
      price,
      changeAmount: num(g['09. change']),
      changePercent: num(g['10. change percent']),
      volume: num(g['06. volume']),
      open: num(g['02. open']),
      high: num(g['03. high']),
      low: num(g['04. low']),
      previousClose: num(g['08. previous close']),
      quoteTime: g['07. latest trading day'] ? `${g['07. latest trading day']}T00:00:00Z` : null,
      // Alpha Vantage's free GLOBAL_QUOTE reflects the latest completed session.
      status: 'DELAYED',
    };
  }

  async getHistoricalData(
    providerSymbol: string,
    days: number
  ): Promise<HistoricalResult> {
    if (!providerSymbol) return { provider: this.name, providerSymbol, points: [], status: 'UNAVAILABLE' };

    const data = await this.fetch({ function: 'TIME_SERIES_DAILY', symbol: providerSymbol, outputsize: 'compact' });
    const series = data?.['Time Series (Daily)'];
    if (!series) {
      return { provider: this.name, providerSymbol, points: [], status: 'UNAVAILABLE' };
    }

    const entries = Object.entries(series).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const num = (v: any): number | null => {
      const n = Number(v);
      return v !== null && v !== undefined && !Number.isNaN(n) ? n : null;
    };

    const points = entries.slice(0, days)
      .map(([date, rec]: [string, any]) => {
        const price = num(rec['4. close']);
        if (price === null) return null;
        return {
          date,
          price,
          volume: num(rec['5. volume']),
          open: num(rec['1. open']),
          high: num(rec['2. high']),
          low: num(rec['3. low']),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .reverse();

    return { provider: this.name, providerSymbol, points, status: points.length ? 'HISTORICAL' : 'UNAVAILABLE' };
  }
}
