import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { apiFetch } from '../utils/helpers';
import { LoadingState, ErrorState, EmptyState, ChangeIndicator } from '../components/StateComponents';
import StockCard from '../components/StockCard';

interface WatchItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  addedAt: string;
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/watchlist');
      if (!res.ok) throw new Error('Failed to load watchlist');
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  if (loading) return <LoadingState text="Loading your watchlist..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadWatchlist} />;

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            Your Watchlist
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Stocks you're tracking</p>
        </div>
        <Link to="/markets" className="btn-primary">Browse Stocks</Link>
      </div>

      {items.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <StockCard
              key={item.symbol}
              symbol={item.symbol}
              name={item.name}
              price={item.price}
              change={item.change}
              changePercent={item.changePercent}
              inWatchlist={true}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Star}
          title="Your watchlist is empty"
          subtitle="Add stocks to your watchlist to track their performance over time."
          action={<Link to="/markets" className="btn-primary">Discover Stocks</Link>}
        />
      )}
    </div>
  );
}
