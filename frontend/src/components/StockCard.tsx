import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { apiFetch, formatCompact, formatPercent } from '../utils/helpers';
import { ChangeIndicator } from './StateComponents';

interface StockCardProps {
  symbol: string;
  name: string;
  price: number | null;
  change: number;
  changePercent: number;
  inWatchlist?: boolean;
  showWatchlistButton?: boolean;
}

export default function StockCard({ symbol, name, price, change, changePercent, inWatchlist = false, showWatchlistButton = true }: StockCardProps) {
  const [watchlisted, setWatchlisted] = useState(inWatchlist);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ date: string; price: number }[]>([]);

  useEffect(() => {
    setWatchlisted(inWatchlist);
  }, [inWatchlist]);

  useEffect(() => {
    if (!showWatchlistButton) {
      apiFetch(`/api/market/stocks/${symbol}/history?days=14`)
        .then(r => r.json())
        .then(data => setPreview(data.slice(-14)))
        .catch(() => {});
    }
  }, [symbol, showWatchlistButton]);

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (watchlisted) {
        await apiFetch('/api/watchlist/remove', {
          method: 'POST',
          body: JSON.stringify({ symbol })
        });
        setWatchlisted(false);
      } else {
        await apiFetch('/api/watchlist/add', {
          method: 'POST',
          body: JSON.stringify({ symbol })
        });
        setWatchlisted(true);
      }
    } catch (err) {
      console.error('Watchlist toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link
      to={`/stock/${symbol}`}
      className="card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group block"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">{symbol}</span>
            <span className={`badge ${changePercent >= 0 ? 'bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400' : 'bg-danger-light dark:bg-danger/10 text-danger-dark dark:text-red-400'}`}>
              <ChangeIndicator change={changePercent} />
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">{name}</p>
        </div>
        {showWatchlistButton && (
          <button
            onClick={toggleWatchlist}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              watchlisted
                ? 'text-amber-500'
                : 'text-gray-300 dark:text-gray-600 hover:text-amber-400 group-hover:text-gray-400'
            }`}
            aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Star className={`w-5 h-5 ${watchlisted ? 'fill-amber-500' : ''}`} />
          </button>
        )}
      </div>

      {!showWatchlistButton && preview.length > 0 && (
        <div className="mt-3 h-12 relative">
          <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
            <polyline
              points={preview.map((p, i) => `${(i / (preview.length - 1)) * 100},${30 - ((p.price - Math.min(...preview.map(x => x.price))) / (Math.max(...preview.map(x => x.price)) - Math.min(...preview.map(x => x.price)) || 1)) * 25}`).join(' ')}
              fill="none"
              stroke={changePercent >= 0 ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {price != null ? formatCompact(price) : '—'}
          </div>
          {price != null ? (
            <ChangeIndicator change={change} className="text-sm" />
          ) : <span className="text-xs text-gray-400">Unavailable</span>}
        </div>
      </div>
    </Link>
  );
}
