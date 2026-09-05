import { useLocation } from 'react-router-dom';
import { Share2 } from 'lucide-react';

export default function Disclaimer({ variant = 'full' }: { variant?: 'full' | 'banner' }) {
  const location = useLocation();

  if (location.pathname.startsWith('/login') || location.pathname.startsWith('/register')) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <div className="disclaimer-banner flex items-center justify-center gap-2 text-center">
        <Share2 className="w-4 h-4 shrink-0 hidden sm:block" />
        <span className="text-xs sm:text-sm">
          StockLab is an educational simulation (Demo Market). Prices come from a market-data provider; all trading is virtual.
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="disclaimer-banner flex items-start gap-3">
        <Share2 className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium mb-1">Demo Market — Educational Simulation Disclaimer &amp; Privacy</p>
          <p className="text-sm opacity-90">
            StockLab is a <strong>paper-trading simulator</strong>. All money and trades are virtual and have
            <strong> no real monetary value</strong> — this app does not execute real trades, provide a brokerage
            account, or handle real money. Stock prices come from a real market-data provider and are for education
            only; they may be delayed or last-known and are not investment advice.
          </p>
          <p className="text-sm opacity-90">
            <strong>Privacy</strong>: StockLab doesn&apos;t sell your personal data. It uses no advertising or third-party
            ad trackers.
          </p>
        </div>
      </div>
    </div>
  );
}