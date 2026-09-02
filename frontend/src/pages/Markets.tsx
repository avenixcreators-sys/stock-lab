import { useState, useEffect, useCallback } from 'react';
import { Search, TrendingUp, Filter, Clock } from 'lucide-react';
import { apiFetch, formatCompact, formatPercent } from '../utils/helpers';
import { LoadingState, ErrorState, EmptyState, ChangeIndicator } from '../components/StateComponents';
import StockCard from '../components/StockCard';
import { Link } from 'react-router-dom';

interface Stock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
}

type MarketStatus = 'open' | 'closed';

export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const hour = ist.getHours();
  const minute = ist.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  if (day === 0 || day === 6) return 'closed';
  if (timeInMinutes >= 9 * 60 + 15 && timeInMinutes <= 15 * 60 + 30) return 'open';
  return 'closed';
}

export default function Markets() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('all');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/market/stocks?limit=5000');
      if (!res.ok) throw new Error('Failed to load stocks');
      const data = await res.json();
      setStocks(data);
      setFilteredStocks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load stocks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  // Debounced remote search: lets users find stocks not in the local catalog.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      // Clear search -> show the full list (respecting sector filter).
      const result = stocks.filter(s => sector === 'all' || s.sector === sector);
      setFilteredStocks(result);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/market/stocks/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        let result = data;
        if (sector !== 'all') result = result.filter((s: any) => s.sector === sector);
        setFilteredStocks(result);
      } catch {
        // fall back to local filtering on error
        const result = stocks.filter(s =>
          (s.symbol.toLowerCase().includes(query.toLowerCase()) ||
           s.name.toLowerCase().includes(query.toLowerCase())) &&
          (sector === 'all' || s.sector === sector)
        );
        setFilteredStocks(result);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, sector, stocks]);

  const sectors = Array.from(new Set(stocks.map(s => s.sector)));
  const marketOpen = getMarketStatus();

  const sortByChange = () => {
    const sorted = [...filteredStocks].sort((a, b) => b.changePercent - a.changePercent);
    setFilteredStocks(sorted);
  };

  const sortByValue = () => {
    const sorted = [...filteredStocks].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    setFilteredStocks(sorted);
  };

  if (loading) return <LoadingState text="Loading market data..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadStocks} />;

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Stock Market
            <span className="inline-flex items-center text-[0.65rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Simulated Trading
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Prices from a market-data provider — trading is virtual</p>
        </div>
        <div className={`flex items-center gap-2 p-2 px-3 rounded-full ${marketOpen === 'open' ? 'bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400' : 'bg-warning-light dark:bg-warning/10 text-warning-dark dark:text-amber-400'} text-sm font-medium`}>
          <span className={`w-2 h-2 rounded-full ${marketOpen === 'open' ? 'bg-success animate-pulse' : 'bg-warning'}`} />
          Market {marketOpen === 'open' ? 'Open' : 'Closed'}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search by company name or symbol (e.g., TCS, Reliance)"
          />
        </div>
        <select
          value={sector}
          onChange={e => setSector(e.target.value)}
          className="input-field md:w-48"
        >
          <option value="all">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={sortByChange} className="btn-secondary text-sm flex items-center gap-1.5">
            <Filter className="w-4 h-4" /> Top Movers
          </button>
          <button onClick={sortByValue} className="btn-secondary text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Value
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Showing {filteredStocks.length} of {stocks.length} companies
        </p>
        <p className="text-xs text-gray-400">Prices from a market-data provider — trading is virtual</p>
      </div>

      {filteredStocks.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStocks.map(stock => (
            <StockCard
              key={stock.symbol}
              symbol={stock.symbol}
              name={stock.name}
              price={stock.price}
              change={stock.change}
              changePercent={stock.changePercent}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No stocks found"
          subtitle="Try a different search term or clear your filters."
          action={
            <button onClick={() => { setSearch(''); setSector('all'); }} className="btn-secondary">
              Clear Search
            </button>
          }
        />
      )}
    </div>
  );
}
