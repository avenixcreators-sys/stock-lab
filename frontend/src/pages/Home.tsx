import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Wallet, Briefcase, Star, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { apiFetch, formatCompact, formatPercent } from '../utils/helpers';
import { LoadingState, ErrorState, EmptyState, ChangeIndicator } from '../components/StateComponents';
import PriceChart from '../components/PriceChart';
import StockCard from '../components/StockCard';

interface PortfolioData {
  cashBalance: number;
  portfolioValue: number;
  totalHoldingsValue: number;
  totalProfitLoss: number;
  totalInvested: number;
  holdings: any[];
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  totalValue: number;
  createdAt: string;
}

export default function Home() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [portfolioRes, txRes, wlRes] = await Promise.all([
        apiFetch('/api/portfolio/portfolio'),
        apiFetch('/api/portfolio/transactions?limit=6'),
        apiFetch('/api/watchlist'),
      ]);

      if (!portfolioRes.ok || !txRes.ok || !wlRes.ok) {
        const failed = [portfolioRes, txRes, wlRes].find(r => !r.ok);
        let detail = '';
        try { detail = (await failed?.json())?.error || ''; } catch { /* ignore */ }
        throw new Error(detail || 'Failed to load data');
      }

      const [portfolioData, txData, wlData] = await Promise.all([portfolioRes.json(), txRes.json(), wlRes.json()]);
      setPortfolio(portfolioData);
      setTransactions(txData);
      setWatchlist(wlData);

      if (portfolioData.holdings && portfolioData.holdings.length > 0) {
        const topSymbol = portfolioData.holdings[0].symbol;
        const historyRes = await apiFetch(`/api/market/stocks/${topSymbol}/history?days=30`);
        const history = await historyRes.json();
        setChartData(history);
      } else {
        const fallbackRes = await apiFetch('/api/market/stocks/RELIANCE/history?days=30');
        const fallback = await fallbackRes.json();
        setChartData(fallback);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState text="Loading your portfolio..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const profitPercent = portfolio ? (portfolio.totalProfitLoss / (portfolio.totalInvested || 1)) * 100 : 0;

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back! 👋</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's your StockLab portfolio overview</p>
        </div>
        <Link to="/markets" className="btn-primary inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Explore Markets
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 p-3 bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-primary-950/30 dark:to-emerald-950/30 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-primary-700 dark:text-primary-300">
          <Wallet className="w-4 h-4" />
          <span>Virtual Cash: {portfolio ? formatCompact(portfolio.cashBalance) : '₹500'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Star className="w-4 h-4 text-amber-400" />
          <span>Paper Trading Mode</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Briefcase className="w-4 h-4" />
            Portfolio Value
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {portfolio ? formatCompact(portfolio.portfolioValue) : '--'}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Wallet className="w-4 h-4" />
            Available Virtual Cash
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {portfolio ? formatCompact(portfolio.cashBalance) : '--'} <span className="text-sm font-normal text-gray-400">Virtual Cash</span>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            Profit/Loss
          </div>
          <div className={`text-2xl font-bold ${(portfolio?.totalProfitLoss || 0) >= 0 ? 'stock-green' : 'stock-red'}`}>
            {portfolio ? formatCompact(portfolio.totalProfitLoss) : '--'}
          </div>
          <div className="text-xs text-gray-400 mt-1">{formatPercent(profitPercent)} overall</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <ArrowUpRight className="w-4 h-4" />
            Investments
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {portfolio ? formatCompact(portfolio.totalInvested) : '--'}
          </div>
          <div className="text-xs text-gray-400 mt-1">{portfolio?.holdings.length || 0} holdings</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Portfolio Performance</h2>
            <span className="text-xs text-gray-400">30 days</span>
          </div>
          {chartData.length > 0 ? (
            <PriceChart data={chartData} />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No data available yet</div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Current Holdings</h2>
            <Link to="/portfolio" className="text-primary-600 dark:text-primary-400 text-sm hover:underline inline-flex items-center">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {portfolio?.holdings && portfolio.holdings.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {portfolio.holdings.slice(0, 5).map((holding: any) => (
                <Link to={`/stock/${holding.symbol}`} key={holding.symbol} className="card p-4 block hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{holding.symbol}</div>
                      <div className="text-xs text-gray-400">{holding.quantity} shares</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatCompact(holding.currentValue)}</div>
                      <ChangeIndicator change={holding.profitLoss} className="text-xs" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No holdings yet"
              subtitle="Start building your virtual portfolio by exploring the markets."
              action={<Link to="/markets" className="btn-primary text-sm">Explore Stocks</Link>}
            />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Watchlist</h2>
            <Link to="/watchlist" className="text-primary-600 dark:text-primary-400 text-sm hover:underline">
              View All
            </Link>
          </div>
          {watchlist.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {watchlist.slice(0, 4).map((stock: any) => (
                <Link to={`/stock/${stock.symbol}`} key={stock.symbol} className="block p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{stock.symbol}</div>
                      <div className="text-xs text-gray-400">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatCompact(stock.price)}</div>
                      <ChangeIndicator change={stock.changePercent} className="text-xs" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Empty watchlist"
              subtitle="Add stocks to track them here."
              action={<Link to="/markets" className="btn-secondary text-sm">Browse Stocks</Link>}
            />
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="section-title">Recent Transactions</h2>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium text-right">Qty</th>
                    <th className="py-2 pr-4 font-medium text-right">Price</th>
                    <th className="py-2 pr-4 font-medium text-right">Total</th>
                    <th className="py-2 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="py-3 pr-4">
                        <span className={`badge ${tx.type === 'buy' ? 'bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400' : 'bg-danger-light dark:bg-danger/10 text-danger-dark dark:text-red-400'}`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{tx.symbol}</div>
                        <div className="text-xs text-gray-400">{tx.name}</div>
                      </td>
                      <td className="py-3 pr-4 text-right">{tx.quantity}</td>
                      <td className="py-3 pr-4 text-right">{formatCompact(tx.price)}</td>
                      <td className="py-3 pr-4 text-right font-medium">{formatCompact(tx.totalValue)}</td>
                      <td className="py-3 text-right text-xs text-gray-400">{tx.createdAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No transactions yet"
              subtitle="Make your first simulated trade to see your history here."
              action={<Link to="/markets" className="btn-primary text-sm">Start Trading</Link>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
