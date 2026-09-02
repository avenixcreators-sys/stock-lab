-- StockLab PostgreSQL schema + Row Level Security (RLS)
-- ======================================================
-- Run this in the Supabase SQL Editor (or as a migration) to provision the
-- production database. It mirrors the local SQLite schema and adds RLS so that
-- each user can only read/write their own data, while market-reference data
-- (stocks, lessons, quiz questions, market data) stays publicly readable.
--
-- Auth model: the `users.id` primary key stores the Supabase Auth user id so it
-- matches `auth.uid()`. On first sign-in the backend's `/api/auth/session`
-- upserts a row here.

-- ======================================================
-- 1. Users (reference to Supabase Auth)
-- ======================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  password_hash text,
  google_id text,
  avatar_url text,
  cash_balance numeric(14,2) not null default 500.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text,
  last_login_at timestamptz
);
-- kept as firebase_uid for backward compatibility with existing rows
alter table public.users add column if not exists firebase_uid uuid;
create index if not exists idx_users_firebase_uid on public.users(firebase_uid);

-- ======================================================
-- 2. Stocks (public reference data)
-- ======================================================
create table if not exists public.stocks (
  symbol text primary key,
  name text not null,
  sector text,
  description text,
  market_cap text,
  pe_ratio numeric,
  dividend_yield numeric,
  fifty_two_week_high numeric,
  fifty_two_week_low numeric,
  last_updated timestamptz default now(),
  exchange text default 'NSE',
  demo_base_price numeric
);

-- ======================================================
-- 3. market_data (public reference)
-- ======================================================
create table if not exists public.market_data (
  id bigserial primary key,
  symbol text not null references public.stocks(symbol),
  price numeric not null,
  change_amount numeric,
  change_percent numeric,
  volume bigint,
  high numeric,
  low numeric,
  open numeric,
  previous_close numeric,
  timestamp timestamptz default now()
);
create index if not exists idx_market_data_symbol on public.market_data(symbol);
create index if not exists idx_market_data_timestamp on public.market_data(timestamp);

-- ======================================================
-- 4. holdings / transactions / watchlist (user-owned)
-- ======================================================
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  quantity integer not null default 0,
  avg_purchase_price numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);
create index if not exists idx_holdings_user on public.holdings(user_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  type text not null check (type in ('buy', 'sell')),
  quantity integer not null,
  price numeric not null,
  total_value numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_user on public.transactions(user_id);

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  added_at timestamptz not null default now(),
  unique (user_id, symbol)
);
create index if not exists idx_watchlist_user on public.watchlist(user_id);

-- ======================================================
-- 5. Learn content (public reference)
-- ======================================================
create table if not exists public.lessons (
  id text primary key,
  title text not null,
  slug text unique not null,
  content text not null,
  order_index integer not null,
  category text default 'basics'
);

create table if not exists public.quiz_questions (
  id text primary key,
  lesson_id text not null references public.lessons(id),
  question text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text,
  order_index integer not null
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id),
  score integer not null,
  total integer not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- ======================================================
-- 6. Row Level Security
-- ======================================================
alter table public.users enable row level security;
alter table public.stocks enable row level security;
alter table public.market_data enable row level security;
alter table public.holdings enable row level security;
alter table public.transactions enable row level security;
alter table public.watchlist enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_results enable row level security;
alter table public.achievements enable row level security;

-- Public reference data: anyone (including anon) can read.
create policy "stocks public read" on public.stocks for select using (true);
create policy "market_data public read" on public.market_data for select using (true);
create policy "lessons public read" on public.lessons for select using (true);
create policy "quiz_questions public read" on public.quiz_questions for select using (true);

-- Users: an authenticated user may read/update only their own profile.
create policy "users self read" on public.users for select using (auth.uid() = id);
create policy "users self update" on public.users for update using (auth.uid() = id);

-- Holdings / transactions / watchlist / quiz_results / achievements: only owner.
create policy "holdings owner all" on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions owner all" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlist owner all" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quiz_results owner all" on public.quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "achievements owner all" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
