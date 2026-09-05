import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Briefcase, Wallet, TrendingUp } from 'lucide-react';
import { apiFetch, formatCompact, formatPercent } from '../utils/helpers';
import { LoadingState, ErrorState, EmptyState, ChangeIndicator } from '../components/StateComponents';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Holding {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  avgPurchasePrice: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface PortfolioData {
  cashBalance: number;
  portfolioValue: number;
  totalHoldingsValue: number;
  totalProfitLoss: number;
  totalInvested: number;
  holdings: Holding[];
}

export default function Portfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pct' | 'symbol'>('value');

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/portfolio/portfolio');
      if (!res.ok) throw new Error('Failed to load portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  if (loading) return <LoadingState text="Loading your portfolio..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadPortfolio} />;
  if (!portfolio) return null;

  const adjustedHoldings = [...portfolio.holdings].sort((a, b) => {
    if (sortBy === 'value') return b.currentValue - a.currentValue;
    if (sortBy === 'pct') return b.profitLossPercent - a.profitLossPercent;
    return a.symbol.localeCompare(b.symbol);
  });

  const allocationData = {
    labels: adjustedHoldings.map(h => h.symbol),
    datasets: [{
      data: adjustedHoldings.map(h => h.currentValue),
      backgroundColor: [
        '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
      ],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your Portfolio</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track your virtual investments</p>
        </div>
        <Link to="/markets" className="btn-primary">Add Stocks</Link>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="card md:col-span-2">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Briefcase className="w-4 h-4" /> Total Portfolio Value
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCompact(portfolio.portfolioValue)}</div>
          <div className="mt-2 text-sm text-gray-500">Virtual Cash + Holdings</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Wallet className="w-4 h-4" /> Available Virtual Cash
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCompact(portfolio.cashBalance)}</div>
          <div className="mt-2 text-xs text-gray-400">Virtual Cash</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4" /> Total Profit/Loss
          </div>
          <div className={`text-2xl font-bold ${portfolio.totalProfitLoss >= 0 ? 'stock-green' : 'stock-red'}`}>
            {portfolio.totalProfitLoss >= 0 ? '+' : ''}{formatCompact(portfolio.totalProfitLoss)}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {portfolio.totalInvested > 0 ? formatPercent((portfolio.totalProfitLoss / portfolio.totalInvested) * 100) : 'No investments yet'}
          </div>
        </div>
      </div>

      {portfolio.holdings.length > 0 ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">Holdings</h2>
              <div className="flex gap-2">
                {(['value', 'pct', 'symbol'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      sortBy === option
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {option === 'value' ? 'Value' : option === 'pct' ? '% Change' : 'Symbol'}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-3 pr-4 font-medium">Company</th>
                    <th className="py-3 pr-4 font-medium text-right">Qty</th>
                    <th className="py-3 pr-4 font-medium text-right">Avg Price</th>
                    <th className="py-3 pr-4 font-medium text-right">Current</th>
                    <th className="py-3 pr-4 font-medium text-right">Value</th>
                    <th className="py-3 font-medium text-right">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustedHoldings.map(h => (
                    <tr key={h.symbol} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 pr-4">
                        <Link to={`/stock/${h.symbol}`} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold">
                            {h.symbol.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{h.symbol}</div>
                            <div className="text-xs text-gray-400">{h.name}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-right">{h.quantity}</td>
                      <td className="py-3 pr-4 text-right">{formatCompact(h.avgPurchasePrice)}</td>
                      <td className="py-3 pr-4 text-right">{formatCompact(h.currentPrice)}</td>
                      <td className="py-3 pr-4 text-right font-medium">{formatCompact(h.currentValue)}</td>
                      <td className="py-3 text-right">
                        <div className={h.profitLoss >= 0 ? 'stock-green' : 'stock-red'}>
                          {h.profitLoss >= 0 ? '+' : ''}{formatCompact(h.profitLoss)}
                        </div>
                        <div className={`text-xs ${h.profitLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatPercent(h.profitLossPercent)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">Allocation</h2>
            {portfolio.holdings.length > 0 ? (
              <>
                <div className="h-64">
                  <Doughnut
                    data={allocationData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '70%',
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
                            font: { size: 11 },
                            padding: 12,
                            usePointStyle: true,
                          }
                        },
                        tooltip: {
                          callbacks: {
                            label: (context: any) => `${context.label}: ${formatCompact(context.parsed)}`,
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Virtual Cash</span>
                    <span className="font-medium">{formatCompact(portfolio.cashBalance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Invested</span>
                    <span className="font-medium">{formatCompact(portfolio.totalHoldingsValue)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">No holdings to display allocation yet.</p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="Your portfolio is empty"
          subtitle="Start building your virtual investment portfolio by buying stocks with your ₹500 Virtual Cash."
          action={<Link to="/markets" className="btn-primary">Explore Stocks</Link>}
        />
      )}
    </div>
  );
}
