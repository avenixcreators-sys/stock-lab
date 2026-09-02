/**
 * MarketDataProvider adapter interface.
 *
 * StockLab talks to the market-data world exclusively through this interface so
 * the underlying provider (Alpha Vantage today, others later) can be swapped
 * without rewriting the rest of the app.
 *
 * All implementations MUST be server-side only. They must never return
 * fabricated/synthetic prices — only data actually supplied by the provider.
 */

export interface DiscoveredInstrument {
  provider: string;
  providerSymbol: string; // symbol as returned/consumed by the provider
  name: string;
  exchange?: string;
  country?: string;
  assetType?: string;
  currency?: string;
}

export interface Quote {
  provider: string;
  providerSymbol: string;
  price: number;
  changeAmount: number | null;
  changePercent: number | null;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  /** Provider-reported timestamp of the quote, if available. */
  quoteTime?: string | null;
  /** 'LIVE' | 'DELAYED' | 'HISTORICAL' as reported/known by the provider. */
  status: 'LIVE' | 'DELAYED' | 'HISTORICAL';
}

export interface HistoricalPoint {
  /** ISO date (YYYY-MM-DD) from the provider. */
  date: string;
  /** Provider close price. */
  price: number;
  volume?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
}

export interface HistoricalResult {
  provider: string;
  providerSymbol: string;
  points: HistoricalPoint[];
  status: 'HISTORICAL' | 'UNAVAILABLE';
}

export interface MarketDataProvider {
  name: string;
  /** True when this provider has credentials/keys configured. */
  isConfigured(): boolean;
  /** Discover/lookup instruments by a free-text query (symbol or company name). */
  searchInstruments(query: string): Promise<DiscoveredInstrument[]>;
  /** Fetch the latest quote for a provider symbol. */
  getQuote(providerSymbol: string): Promise<Quote | null>;
  /** Fetch historical daily prices for a provider symbol. */
  getHistoricalData(providerSymbol: string, days: number): Promise<HistoricalResult>;
}
