import type { MarketDataProvider, HistoricalResult } from './types.js';
import { AlphaVantageProvider } from './alphaVantage.js';
import { YahooFinanceProvider } from './yahooFinance.js';

/**
 * Composite provider.
 *
 * Alpha Vantage serves discovery (SYMBOL_SEARCH) and quotes (GLOBAL_QUOTE),
 * which work for NSE symbols. Its free tier returns NO daily history for
 * NSE `.NS` symbols (all series endpoints return empty), so this composite
 * falls back to Yahoo Finance for history — which does return real NSE daily
 * prices. Historical data is still only ever data actually supplied by a
 * provider; nothing is fabricated.
 */
export class CompositeProvider implements MarketDataProvider {
  readonly name = 'composite';
  constructor(
    private readonly primary: MarketDataProvider,
    private readonly historyBackup: MarketDataProvider
  ) {}

  isConfigured(): boolean {
    return this.primary.isConfigured() || this.historyBackup.isConfigured();
  }

  searchInstruments(query: string) {
    return this.primary.searchInstruments(query);
  }

  getQuote(providerSymbol: string) {
    return this.primary.getQuote(providerSymbol);
  }

  async getHistoricalData(providerSymbol: string, days: number): Promise<HistoricalResult> {
    try {
      const result = await this.primary.getHistoricalData(providerSymbol, days);
      if (result.status === 'HISTORICAL' && result.points.length) {
        return result;
      }
    } catch {
      // fall through to the history backup
    }
    return this.historyBackup.getHistoricalData(providerSymbol, days);
  }
}

/**
 * Factory that returns the configured market-data provider.
 *
 * Selection is driven by MARKET_DATA_PROVIDER. Config is read from the backend
 * environment at call time so it reflects the latest env values. If the primary
 * provider is not configured with an API key, stocklab falls back to its local
 * legitimate cache and marks data as stale / unavailable — it never fabricates
 * prices.
 */
export function createMarketDataProvider(): MarketDataProvider {
  const provider = (process.env.MARKET_DATA_PROVIDER || 'alpha_vantage').toLowerCase();

  switch (provider) {
    case 'alpha_vantage': {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      const interval = Number(process.env.MARKET_DATA_MIN_INTERVAL_MS) || 1000;
      return new CompositeProvider(
        new AlphaVantageProvider(apiKey, interval),
        new YahooFinanceProvider()
      );
    }
    default:
      throw new Error(`Unknown MARKET_DATA_PROVIDER: ${provider}`);
  }
}

/** Whether a market-data provider has credentials configured. */
export function isMarketDataConfigured(): boolean {
  try {
    return createMarketDataProvider().isConfigured();
  } catch {
    return false;
  }
}

export type { MarketDataProvider } from './types.js';
