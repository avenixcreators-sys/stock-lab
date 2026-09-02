import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatCompact } from '../utils/helpers';
import { LoadingState, ErrorState, EmptyState } from '../components/StateComponents';
import { Clock } from 'lucide-react';

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

type Filter = 'all' | 'buy' | 'sell';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/portfolio/transactions?filter=${filter}&limit=100`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  if (loading) return <LoadingState text="Loading transaction history..." height="h-screen" />;
  if (error) return <ErrorState message={error} onRetry={loadTransactions} />;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'Z'));
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">All your simulated trades</p>
      </div>

      <div className="flex gap-2">
        {(['all', 'buy', 'sell'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f === 'buy' ? 'Buys' : 'Sells'}
          </button>
        ))}
      </div>

      {transactions.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Company</th>
                  <th className="py-3 pr-4 font-medium text-right">Quantity</th>
                  <th className="py-3 pr-4 font-medium text-right">Price</th>
                  <th className="py-3 pr-4 font-medium text-right">Total Value</th>
                  <th className="py-3 font-medium text-right">Date/Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-3.5 pr-4">
                      <span className={`badge ${tx.type === 'buy' ? 'bg-success-light dark:bg-success/10 text-success-dark dark:text-emerald-400' : 'bg-danger-light dark:bg-danger/10 text-danger-dark dark:text-red-400'}`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="font-medium">{tx.symbol}</div>
                      <div className="text-xs text-gray-400">{tx.name}</div>
                    </td>
                    <td className="py-3.5 pr-4 text-right">{tx.quantity}</td>
                    <td className="py-3.5 pr-4 text-right">{formatCompact(tx.price)}</td>
                    <td className={`py-3.5 pr-4 text-right font-medium ${tx.type === 'buy' ? 'text-danger' : 'text-success'}`}>
                      {tx.type === 'buy' ? '-' : '+'}{formatCompact(tx.totalValue)}
                    </td>
                    <td className="py-3.5 text-right text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="No transactions yet"
          subtitle="Your simulated buy and sell orders will appear here."
          action={<a href="/markets" className="btn-primary">Start Trading</a>}
        />
      )}
    </div>
  );
}
