import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database.js';
import { initializeFirebase, isFirebaseReady, getFirebaseFailureReason } from './services/firebase.js';
import { authenticateToken } from './middleware/auth.js';
import { isMarketDataConfigured } from './services/providers/index.js';
import { refreshAllQuotes } from './services/marketData.js';
import authRoutes from './routes/auth.js';
import marketRoutes from './routes/market.js';
import portfolioRoutes from './routes/portfolio.js';
import watchlistRoutes from './routes/watchlist.js';
import learnRoutes from './routes/learn.js';
import userRoutes from './routes/user.js';
import aiRoutes from './routes/ai.js';

export const app = express();
export const API_PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

if (process.env.HTTP_LOG === '1') {
  app.use((req, _res, next) => {
    console.log(`[http] ${req.method} ${req.originalUrl}`);
    next();
  });
}

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
app.use('/api/ai', authenticateToken, aiRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'StockLab API is running',
    auth: isFirebaseReady() ? 'configured' : 'not-configured',
    marketData: isMarketDataConfigured() ? 'configured' : 'not-configured',
    disclaimer: 'StockLab is an educational stock-market simulator (Demo Market). All money and trades are virtual; prices come from a legitimate market-data provider.'
  });
});

initializeDatabase();
initializeFirebase();

// Populate the market list with REAL provider prices in the background, and
// keep prices current on a timer. No prices are ever fabricated: symbols that
// fail simply stay marked unavailable and are retried each cycle.
const MARKET_REFRESH_MS = Number(process.env.MARKET_REFRESH_MS) || 5 * 60 * 1000;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Start the periodic + initial market-data refresh. Safe to call once. */
export function startMarketRefresh(): void {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    refreshAllQuotes().catch(e => console.error('Market backfill cycle failed:', (e as Error).message));
  }, MARKET_REFRESH_MS);
  // First run shortly after boot (gives the HTTP server time to start).
  setTimeout(() => {
    refreshAllQuotes({ onBatch: (done, total) => {
      if (done % 50 === 0) console.log(`[market] backfill ${done}/${total}`);
    } }).then(r => console.log(`[market] backfill finished: refreshed=${r.refreshed} failed=${r.failed}`));
  }, 5 * 1000);
}

/** Startup status logging used by the local dev entry point. */
export function logStartupStatus(): void {
  if (isFirebaseReady()) {
    console.log('Firebase Authentication: configured');
    console.log('AI Teacher (Groq): ' + (process.env.GROQ_API_KEY ? 'configured' : 'NOT configured'));
  } else {
    console.warn(`Firebase Authentication: NOT configured — ${getFirebaseFailureReason() || 'unknown reason'}`);
    console.warn('Sign-in endpoints will return 503 until Firebase Admin credentials are added to backend/.env');
  }
  if (isMarketDataConfigured()) {
    console.log('Market data provider: configured');
  } else {
    console.warn('Market data provider: NOT configured — quotes will show last-known cached data marked stale. Add ALPHA_VANTAGE_API_KEY to backend/.env.');
  }
}

// Serve the built SPA (self-contained single-service mode). Set STATIC_DIR to
// point at the frontend build; when absent, we look for ../frontend/dist.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  // SPA fallback: any non-/api GET route serves the app shell.
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(path.join(staticDir, 'index.html'), (err: any) => {
      if (err) next(err);
    });
  });
}

// JSON 404: unmatched routes return JSON (never the default HTML 404 page).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global JSON error handler: ensures NO uncaught error ever returns an HTML 500
// page. The frontend calls res.json() on every response, so HTML bodies would
// surface as a cryptic "JSON.parse: unexpected character" error in the UI.
app.use((err: any, req: any, res: any, _next: any) => {
  console.error(`[api-error] ${req.method} ${req.originalUrl}:`, err?.message || err);
  res.status(err?.status || 500).json({
    error: err?.message || 'Something went wrong on the server.',
  });
});