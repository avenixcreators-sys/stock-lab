import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

export function LoadingState({ text = 'Loading...', height = 'h-64' }: { text?: string; height?: string }) {
  return (
    <div className={`${height} flex flex-col items-center justify-center animate-fade-in`}>
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">{text}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <AlertCircle className="w-12 h-12 text-danger mb-4" />
      <h3 className="font-semibold mb-2">Something went wrong</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }: {
  icon?: any;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  const IconComponent = Icon || TrendingUp;
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <IconComponent className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-sm">{subtitle}</p>
      {action}
    </div>
  );
}

export function ChangeIndicator({ change, className = '' }: { change: number | null; className?: string }) {
  if (change == null || Number.isNaN(change)) {
    return <span className={`inline-flex items-center gap-1 text-gray-400 ${className}`}>--</span>;
  }
  const isUp = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 ${isUp ? 'stock-green' : 'stock-red'} ${className}`}>
      {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {isUp ? '+' : ''}{change.toFixed(2)}
    </span>
  );
}
