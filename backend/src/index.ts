import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './database.js';
import { initializeSupabase, isSupabaseReady, getSupabaseFailureReason } from './services/supabase.js';
import { authenticateToken } from './middleware/auth.js';
import { isMarketDataConfigured } from './services/providers/index.js';
import authRoutes from './routes/auth.js';
import marketRoutes from './routes/market.js';
import portfolioRoutes from './routes/portfolio.js';
import watchlistRoutes from './routes/watchlist.js';
import learnRoutes from './routes/learn.js';
import userRoutes from './routes/user.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later' }
});
app.use('/api/auth/', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', authenticateToken, portfolioRoutes);
app.use('/api/watchlist', authenticateToken, watchlistRoutes);
app.use('/api/learn', authenticateToken, learnRoutes);
app.use('/api/user', authenticateToken, userRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'StockLab API is running',
    auth: isSupabaseReady() ? 'configured' : 'not-configured',
    marketData: isMarketDataConfigured() ? 'configured' : 'not-configured',
    disclaimer: 'StockLab is an educational stock-market simulator (Demo Market). All money and trades are virtual; prices come from a legitimate market-data provider.'
  });
});

initializeDatabase();
initializeSupabase();

app.listen(PORT, () => {
  console.log(`StockLab API running on port ${PORT}`);
  console.log('Database initialized and demo market seeded.');
  if (isSupabaseReady()) {
    console.log('Supabase Authentication: configured');
  } else {
    console.warn(`Supabase Authentication: NOT configured — ${getSupabaseFailureReason() || 'unknown reason'}`);
    console.warn('Sign-in endpoints will return 503 until Supabase credentials are added to backend/.env');
  }
  if (isMarketDataConfigured()) {
    console.log('Market data provider: configured');
  } else {
    console.warn('Market data provider: NOT configured — quotes will show last-known cached data marked stale. Add ALPHA_VANTAGE_API_KEY to backend/.env.');
  }
});
