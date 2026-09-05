import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, TrendingUp, Briefcase, Star, BookOpen, User, LogOut, Menu, X, Sun, Moon, LineChart, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/markets', label: 'Markets', icon: TrendingUp },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/ai-teacher', label: 'AI Teacher', icon: Bot },
  { to: '/profile', label: 'Profile', icon: User },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (location.pathname.startsWith('/login') || location.pathname.startsWith('/register')) {
    return null;
  }

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
              StockLab
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === item.to
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="hidden md:flex items-center gap-2 p-1.5 pr-3 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`fixed inset-y-0 right-0 z-40 w-64 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="font-medium text-sm">{user?.name || 'User'}</div>
              <div className="text-xs text-gray-500">{user?.email}</div>
            </div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-3 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                location.pathname === item.to
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="px-3 py-3 rounded-lg text-sm font-medium flex items-center gap-3 text-danger hover:bg-danger-light dark:hover:bg-danger/10 transition-colors mt-2"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
