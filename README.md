# StockLab 🎓

StockLab is an **educational stock-market simulation platform** designed for students and young learners. It simulates buying and selling stocks using **virtual Cash** — no real money, no real trades, no brokerage account.

> **Disclaimer:** StockLab is an educational stock-market simulator. All money and trades are virtual. This app does not execute real trades or provide a brokerage account.

## 🚀 Features

- **Authentication** — Email/password registration, login, Google auth, logout, password reset, user profile
- **₹500 Virtual Wallet** — Every new account starts with ₹500 Cash stored securely on the backend
- **Home Dashboard** — Portfolio value, available cash, profit/loss, performance chart, holdings, watchlist, recent transactions
- **Stock Market** — Search stocks, company details, current prices, percentage changes, market status, watchlist
- **Stock Details** — Interactive price charts with time ranges, company info, buy/sell order panel
- **Simulated Trading** — Server-side validated buy/sell orders that verify cash and shares
- **Portfolio** — Holdings with avg purchase price, current value, profit/loss, allocation chart
- **Transaction History** — Filterable buy/sell records
- **Watchlist** — Personal stock tracking
- **Learning Center** — 12 beginner lessons with quizzes
- **Gamification** — Badges and achievements for completing activities
- **Dark/Light Mode** — Fully responsive fintech-inspired UI

## 🏗️ Architecture

The application is split into modular services:

```
StockLab/
├── backend/            # Node.js + Express + SQLite
│   └── src/
│       ├── routes/     # API route handlers
│       ├── services/   # market-data service (replaceable)
│       ├── middleware/ # auth & validation
│       ├── database.ts # schema & seed
│       └── index.ts    # server entry
└── frontend/           # React + Vite + Tailwind
    └── src/
        ├── pages/      # Route components
        ├── components/ # Reusable UI
        ├── context/    # Auth & theme providers
        └── utils/      # Helpers
```

The **market-data service** (`backend/src/services/marketData.ts`) is an abstraction layer, so a third-party provider (e.g., Alpha Vantage) can be swapped in without rebuilding the app. No API keys are exposed in frontend code.

## 📦 Setup

Requires **Node.js 18+**.

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both frontend & backend in dev mode
npm run dev
```

Backend runs on `http://localhost:3001`, frontend on `http://localhost:5173`.

### Environment variables (backend/.env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Backend port |
| `JWT_SECRET` | `stocklab_sim_jwt_secret_key_2024` | JWT signing |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `ALPHA_VANTAGE_KEY` | `demo` | Market data provider key (if using Alpha Vantage) |

## 🔒 Security

- Passwords hashed with bcrypt (12 rounds)
- JWT-based authentication with 7-day expiry
- Server-side transaction validation (verifies cash & shares from DB, never trusts client)
- Rate limiting on all API routes and stricter limits on auth routes
- SQL parameterization against injection
- Google/email auth separation with account linking
- All balances stored server-side

## 🎮 Gamification Badges

- 🏆 **First Steps** — Complete your first lesson
- 🎓 **Knowledge Seeker** — Complete 5 lessons
- 📚 **Market Scholar** — Complete 10 lessons
- 👑 **Stock Expert** — Complete all 12 lessons
- 💼 **Portfolio Builder** — Make your first trade
- 🌐 **Diversifier** — Hold 5 different stocks
- ⭐ **Tracker** — Add 3 stocks to watchlist
- 📈 **First Trade** — Complete your first order

## ⚠️ Not a Brokerage

StockLab never executes real trades, handles real money, or provides a brokerage account. All values (`₹` Cash) are purely virtual for education.
