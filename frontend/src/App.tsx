import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Disclaimer from './components/Disclaimer';
import { useAuth } from './context/AuthContext';
import { LoadingState } from './components/StateComponents';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Markets from './pages/Markets';
import StockDetail from './pages/StockDetail';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import Transactions from './pages/Transactions';
import Learn from './pages/Learn';
import LessonDetail from './pages/LessonDetail';
import Achievements from './pages/Achievements';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState text="Loading..." height="h-screen" />;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState text="Loading..." height="h-screen" />;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState text="Starting StockLab..." height="h-screen" />;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className={`${user ? 'pt-16' : ''}`}>
        <div className={user || location.pathname.startsWith('/login') || location.pathname.startsWith('/register') ? '' : ''}>
          <Routes>
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/markets" element={<ProtectedRoute><Markets /></ProtectedRoute>} />
            <Route path="/stock/:symbol" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
            <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
            <Route path="/learn/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
            <Route path="/learn/:slug" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
      {user && <Disclaimer />}
    </div>
  );
}
