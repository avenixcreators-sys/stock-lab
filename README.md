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
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `FIREBASE_SERVICE_ACCOUNT_B64` | — | base64 Firebase service-account JSON (auth) |
| `GROQ_API_KEY` | — | AI Teacher provider key |
| `ALPHA_VANTAGE_API_KEY` | — | Market data provider key |

## 🚀 Deployment

StockLab supports two deployment shapes:

1. **Firebase Hosting + Cloud Functions** — the API runs as a Cloud Function. **Requires the Blaze (pay-as-you-go) plan.**
2. **Single self-contained service** — the backend serves both the API and the built frontend from one process. Runs on any free host (Render / Railway / Fly.io) with **no Blaze plan required**.

### Option A — Firebase (requires Blaze)

- The React app builds to `frontend/dist` and is served by Firebase Hosting.
- The Express API runs as the `api` Cloud Function (`backend/src/functions.ts`); Hosting rewrites `/api{,/**}` to it.
- The SQLite market cache is per-instance under `/tmp` on serverless; it re-seeds on cold start and re-fetches real prices from the provider while the instance is warm.

#### One-time project setup

1. **Upgrade the Firebase project to the Blaze (pay-as-you-go) plan.** Cloud Functions cannot run on the free Spark plan. See
   https://console.firebase.google.com/project/<PROJECT_ID>/usage/details
2. Make sure `backend/.env` holds the runtime values the function needs:
   `FIREBASE_SERVICE_ACCOUNT_B64`, `GROQ_API_KEY`, `ALPHA_VANTAGE_API_KEY`.
3. Set the default project: `firebase use avenix-stocklab` (already configured in `.firebaserc`).

#### Deploy

```bash
npm run build          # backend dist/ + frontend dist/
firebase deploy        # deploys firestore rules, hosting, and the api function
```

Hosting URL: `https://<PROJECT_ID>.web.app` (e.g. https://avenix-stocklab.web.app).

To deploy a single piece: `firebase deploy --only hosting`, `--only functions`, or `--only firestore`.

After adding or changing function environment variables, re-run `firebase deploy --only functions` so they take effect.

For local emulation of the hosted stack: `npm --prefix backend run serve` (requires the Firebase CLI).

### Option B — Single service on a free host (no Blaze)

The backend serves the built SPA itself (see `backend/src/app.ts`, `STATIC_DIR`), so one process hosts the whole app.

1. Build both parts, then start the server:
   ```bash
   npm run build      # backend/dist + frontend/dist
   npm start          # node backend/dist/index.js
   ```
2. Or use the included `Dockerfile` + `render.yaml` (Blueprint) for a one-click Render deploy from the GitHub repo.

Runtime env vars the service needs:

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (e.g. `10000`) |
| `FRONTEND_URL` | Served origin, used for CORS |
| `FIREBASE_SERVICE_ACCOUNT_B64` | base64 service-account JSON for Firebase Auth verification |
| `GROQ_API_KEY` | AI Teacher |
| `ALPHA_VANTAGE_API_KEY` | Market-data provider |
| `DATABASE_PATH` | Optional; default keeps the SQLite cache under the bundle dir or `/tmp` |

Frontend build config lives in `frontend/.env.production` (public Firebase web config only — safe to commit).

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
