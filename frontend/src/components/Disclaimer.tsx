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
        <div>
          <p className="font-medium mb-1">Demo Market — Educational Simulation Disclaimer</p>
          <p className="text-sm opacity-90">
            StockLab is an educational stock-market simulator (Demo Market). Prices come from a
            legitimate market-data provider and may be delayed or last-known prices; they are not
            intended as investment advice. All money and trades are virtual.
            This app does not execute real trades or provide a brokerage account. No real money is
            involved anywhere in this application.
          </p>
        </div>
      </div>
    </div>
  );
}