import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Star, ArrowUpRight, ArrowDownRight, Building2, BarChart3, Percent, Wallet, TrendingUp, ShieldOff, X } from 'lucide-react';
import { apiFetch, formatCompact, formatPercent } from '../utils/helpers';
import { getCatalog } from '../services/marketData';
import { LoadingState, ErrorState, ChangeIndicator } from '../components/StateComponents';
import PriceChart from '../components/PriceChart';
import { useAuth } from '../context/AuthContext';

type OrderType = 'buy' | 'sell' | null;

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  exchange?: string;
  description: string;
  price: number;
  change_amount: number;
  change_percent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previous_close: number;
  market_cap: string;
  pe_ratio: number;
  dividend_yield: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  inWatchlist: boolean;
  data_status?: string;
  inCatalog?: boolean;
}

const timeRanges = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

export default function StockDetail() {
  const { symbol } = useParams();
  const { user, updateUser } = useAuth();
  const [stock, setStock] = useState<StockData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [watchlisted, setWatchlisted] = useState(false);
  const [tradeType, setTradeType] = useState<OrderType>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [ownedQty, setOwnedQty] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');
  const [portfolio, setPortfolio] = useState<{ cashBalance: number } | null>(null);

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catalog, res] = await Promise.all([
        getCatalog(),
        apiFetch(`/api/market/stocks/${symbol}`),
      ]);
      if (!res.ok) throw new Error('Stock not found');
      const data = await res.json();
      const listed = catalog.find(
        (s: any) => s.symbol.toLowerCase() === String(symbol || '').toLowerCase()
      );
      if (!listed && data.price == null) {
        setError(`"${symbol}" isn't a stock in StockLab's catalog. Search Markets to pick a real stock.`);
        setLoading(false);
        return;
      }
      const stockData = listed
        ? { ...data, name: listed.name, sector: listed.sector, inCatalog: true }
        : { ...data, inCatalog: false };
      setStock(stockData);
      setWatchlisted(data.inWatchlist);

      const historyRes = await apiFetch(`/api/market/stocks/${symbol}/history?days=30`);
      const historyData = await historyRes.json();
      setHistory(historyData);

      const portfolioRes = await apiFetch('/api/portfolio/portfolio');
      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json();
        setPortfolio({ cashBalance: portfolioData.cashBalance });
        const holding = portfolioData.holdings.find((h: any) => h.symbol === symbol?.toUpperCase());
        if (holding) setOwnedQty(holding.quantity);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const loadHistory = async (days: number) => {
    setRange(days);
    try {
      const res = await apiFetch(`/api/market/stocks/${symbol}/history?days=${days}`);
      const data = await res.json();
      setHistory(data);
    } catch {
      console.error('Failed to load history');
    }
  };

  const toggleWatchlist = async () => {
    try {
      if (watchlisted) {
        await apiFetch('/api/watchlist/remove', { method: 'POST', body: JSON.stringify({ symbol: symbol?.toUpperCase() }) });
      } else {
        await apiFetch('/api/watchlist/add', { method: 'POST', body: JSON.stringify({ symbol: symbol?.toUpperCase() }) });
      }
      setWatchlisted(!watchlisted);
    } catch (err) {
      console.error('Watchlist error:', err);
    }
  };

  const submitOrder = async () => {
    if (!quantity || (typeof quantity === 'number' && quantity <= 0)) {
      setTradeError('Please enter a valid quantity');
      return;
    }
    setSubmitting(true);
    setTradeError('');
    setTradeSuccess('');

    try {
      const res = await apiFetch(`/api/portfolio/${tradeType}`, {
        method: 'POST',
        body: JSON.stringify({ symbol: symbol?.toUpperCase(), quantity: Number(quantity) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTradeSuccess(data.transaction.type === 'buy'
        ? `Successfully bought ${data.transaction.quantity} shares of ${data.transaction.symbol} for ${formatCompact(data.transaction.totalCost)} Virtual Cash`
        : `Successfully sold ${data.transaction.quantity} shares of ${data.transaction.symbol} for ${formatCompact(data.transaction.totalProceeds)} Virtual Cash`
      );
      updateUser({ cashBalance: data.newCashBalance });
      setQuantity('');
      setTradeType(null);
      loadStock();
      setTimeout(() => setTradeSuccess(''), 4000);
    } catch (err: any) {
      setTradeError(err.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState text="Loading stock data..." height="h-screen" />;
  if (error || !stock) return <ErrorState message={error || 'Stock not found'} onRetry={loadStock} />;

  const isUp = (stock.change_amount ?? 0) >= 0;
  const dataStatus = (stock.data_status || '').toUpperCase();
  const statusBadge =
    dataStatus === 'LIVE' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 border-green-200 dark:border-green-800'
    : dataStatus === 'DELAYED' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    : dataStatus === 'CACHED' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  const statusLabel =
    dataStatus === 'LIVE' ? 'Live'
    : dataStatus === 'DELAYED' ? 'Delayed'
    : dataStatus === 'CACHED' ? 'Cached'
    : 'Unavailable';
  const statusNote =
    dataStatus === 'LIVE'
      ? 'Real-time market price — trading is virtual.'
      : dataStatus === 'DELAYED'
      ? 'Delayed market price from a data provider — trading is virtual.'
      : dataStatus === 'CACHED'
      ? 'Last known price from a data provider — market data currently unavailable.'
      : dataStatus === 'UNAVAILABLE' && stock.inCatalog === false
      ? `${stock.name} isn't in StockLab's catalog — search Markets for listed Indian stocks.`
      : 'Market data currently unavailable. Please try again shortly.';
  const totalCost = typeof quantity === 'number' ? quantity * stock.price : 0;
  const totalProceeds = typeof quantity === 'number' ? quantity * stock.price : 0;
  const canAfford = portfolio && totalCost <= portfolio.cashBalance;

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-lg font-bold shrink-0">
            {stock.symbol.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{stock.name}</h1>
              <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{stock.symbol}</span>
              {stock.exchange && (
                <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{stock.exchange}</span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{stock.name} · {stock.sector} Sector</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleWatchlist}
            className={`p-2.5 rounded-xl border transition-colors flex items-center gap-2 text-sm font-medium ${
              watchlisted
                ? 'border-amber-300 dark:border-amber-700 text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-300'
            }`}
          >
            <Star className={`w-4 h-4 ${watchlisted ? 'fill-amber-500' : ''}`} />
            {watchlisted ? 'Watchlisted' : 'Watchlist'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">{stock.price != null ? formatCompact(stock.price) : '--'}</div>
              <span className={`inline-flex items-center text-[0.6rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusBadge}`}>
                {statusLabel}
              </span>
            </div>
            <div className={`mt-2 flex items-center gap-3 text-sm ${isUp ? 'stock-green' : 'stock-red'}`}>
              <ChangeIndicator change={stock.change_amount} />
              <span>{formatPercent(stock.change_percent)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 max-w-xs text-right">
            {statusNote}
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {timeRanges.map(r => (
            <button
              key={r.label}
              onClick={() => loadHistory(r.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r.days
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {history.length > 0 ? (
          <PriceChart data={history} showVolume />
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400">Historical data unavailable</div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="section-title">Company Information</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{stock.description}</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Building2 className="w-3.5 h-3.5" /> Market Cap
                </div>
                <div className="font-semibold text-sm">{stock.market_cap || '--'}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <BarChart3 className="w-3.5 h-3.5" /> P/E Ratio
                </div>
                <div className="font-semibold text-sm">{stock.pe_ratio?.toFixed(1) || '--'}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Percent className="w-3.5 h-3.5" /> Dividend Yield
                </div>
                <div className="font-semibold text-sm">{stock.dividend_yield ? `${stock.dividend_yield}%` : '--'}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> 52W High
                </div>
                <div className="font-semibold text-sm">{formatCompact(stock.fifty_two_week_high || stock.high)}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> 52W Low
                </div>
                <div className="font-semibold text-sm">{formatCompact(stock.fifty_two_week_low || stock.low)}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Today's Volume
                </div>
                <div className="font-semibold text-sm">{stock.volume?.toLocaleString('en-IN') || '--'}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">Today's Market Data</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Open</div>
                <div className="font-semibold">{formatCompact(stock.open)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Previous Close</div>
                <div className="font-semibold">{formatCompact(stock.previous_close)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Day High</div>
                <div className="font-semibold stock-green">{formatCompact(stock.high)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Day Low</div>
                <div className="font-semibold stock-red">{formatCompact(stock.low)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card h-fit lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Paper Trading</h2>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <ShieldOff className="w-3.5 h-3.5" /> Virtual only
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Available Virtual Cash</span>
              <span className="font-semibold flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-primary-500" />
                {portfolio ? formatCompact(portfolio.cashBalance) : user ? formatCompact(user.cashBalance) : '--'}
              </span>
            </div>
            {tradeType === 'sell' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">You own</span>
                <span className="font-semibold">{ownedQty} shares</span>
              </div>
            )}
          </div>

          {!tradeType ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setTradeType('buy'); setTradeError(''); setTradeSuccess(''); }}
                className="btn-success py-3"
              >
                Buy
              </button>
              <button
                onClick={() => { setTradeType('sell'); setTradeError(''); setTradeSuccess(''); }}
                className="btn-danger py-3"
                disabled={ownedQty <= 0}
              >
                Sell
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">
                  {tradeType === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
                </h3>
                <button
                  onClick={() => setTradeType(null)}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Price</span>
                  <span className="font-medium">{formatCompact(stock.price)}</span>
                </div>
                {tradeType === 'sell' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Owned</span>
                    <span className="font-medium">{ownedQty} shares</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={tradeType === 'sell' ? ownedQty : undefined}
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="input-field"
                  placeholder="Enter quantity"
                />
              </div>

              <div className="p-3 rounded-xl space-y-1.5 text-sm bg-primary-50 dark:bg-primary-900/20">
                {tradeType === 'buy' ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Estimated total cost</span>
                    <span className="font-semibold text-lg">{formatCompact(totalCost)} Virtual Cash</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Estimated proceeds</span>
                    <span className="font-semibold text-lg">{formatCompact(totalProceeds)} Virtual Cash</span>
                  </div>
                )}
              </div>

              {tradeError && (
                <div className="p-3 rounded-lg bg-danger-light dark:bg-danger/10 text-danger-dark dark:text-red-400 text-sm">
                  {tradeError}
                </div>
              )}
              {tradeSuccess && (
                <div className="p-3 rounded-lg bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400 text-sm animate-fade-in">
                  {tradeSuccess}
                </div>
              )}

              <button
                onClick={submitOrder}
                disabled={submitting || !quantity || (tradeType === 'buy' && !canAfford) || (tradeType === 'sell' && Number(quantity) > ownedQty)}
                className={`w-full py-3 rounded-xl font-medium text-white transition-all ${tradeType === 'buy' ? 'btn-success' : 'btn-danger'} disabled:opacity-50`}
              >
                {submitting ? 'Processing...' : `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'} Order`}
              </button>

              {tradeType === 'buy' && totalCost > 0 && !canAfford && (
                <p className="text-xs text-danger text-center">Insufficient Virtual Cash. You need {formatCompact(totalCost)} but have {portfolio ? formatCompact(portfolio.cashBalance) : '--'}.</p>
              )}
              {tradeType === 'sell' && Number(quantity) > ownedQty && (
                <p className="text-xs text-danger text-center">You can't sell more than the {ownedQty} shares you own.</p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">
            This is a paper-trading transaction using Virtual Cash. No real money is involved.
          </p>
        </div>
      </div>
    </div>
  );
}
