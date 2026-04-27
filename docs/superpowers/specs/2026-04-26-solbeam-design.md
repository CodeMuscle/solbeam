# SolBeam — Full System Design Spec

**Date:** 2026-04-26  
**Status:** Approved for implementation  
**Stack:** Next.js 15 · Supabase · Helius · DexScreener · Jupiter · Upstash Redis · Vercel · Telegram  
**Infra cost:** $0/month (personal use, all free tiers)  
**Reference:** Designed to surpass karoshi.fun/dashboard

---

## 1. What We're Building

SolBeam is a personal Solana memecoin intelligence dashboard. It discovers tokens across three channels (Pump.fun new launches, Raydium migrations, and trending tokens gaining momentum), scores each one 0–100 using a composite signal engine validated against historical outcomes, monitors open positions in real-time for break-even alerts, and supports paper trading to validate signal quality before risking real money.

It is a manual trading assistant — it tells you when and what to buy, you execute on GMGN or Jupiter. Semi-auto and full-bot modes are out of scope for v1 but the architecture is designed to accommodate them later.

---

## 2. Architecture Overview

### Data Pipeline (Hybrid — Approach C)

Three parallel discovery channels feed one scoring engine:

```
┌─────────────────────────────────────────────────────────────────┐
│ SOURCES                                                         │
│  DexScreener API ──→ new pairs, OHLCV, volume (poll every 30s) │
│  Helius Webhooks ──→ smart wallet txs (sub-second)             │
│  Jupiter Price API → live SPL prices (position monitor)        │
│  Helius DAS API ───→ token metadata, holder data, deployer     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ INGEST LAYER                                                    │
│  POST /api/webhooks/helius  — validates HMAC secret             │
│  GET  /api/cron/scan        — Supabase pg_cron + pg_net, every 30s │
│  Upstash Redis              — hot token cache, 60s TTL          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ SIGNAL ENGINE                                                   │
│  1. Hard disqualifier filter (instant veto)                     │
│  2. Composite score calculator (0–100)                          │
│  3. Outcome tier classifier                                     │
│  4. Position exit monitor (break-even + take-profit)            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│ OUTPUT                                                          │
│  Supabase Postgres  — tokens, txs, positions, scores, history   │
│  Supabase Realtime  — live push to dashboard UI                 │
│  Telegram Bot       — break-even + high-score alerts            │
│  Next.js Dashboard  — sidebar layout, personal UI               │
└─────────────────────────────────────────────────────────────────┘
```

### Free Tier Budget

| Service | Limit | Our usage | Headroom |
|---|---|---|---|
| Helius | 1M credits/mo | ~300K | 70% |
| DexScreener | 300 req/min | ~2 req/min (every 30s) | 99% |
| Jupiter Price API | Unlimited | Minimal | — |
| CoinGecko free API | 30 req/min | ~2 req/min | 93% |
| Telegram Bot API | Unlimited | Group metadata checks only | — |
| Supabase DB | 500MB | ~50MB/mo | Months |
| Supabase Realtime | 2M msgs/mo | ~10K | 99% |
| Upstash Redis | 10K cmds/day | ~500/day | 95% |
| Vercel Hobby | 100GB bandwidth | Negligible | — |
| Telegram Bot | Free | Alert delivery | — |

**Total: $0/month.**

To stay under Supabase's 500MB limit indefinitely: raw transactions older than 30 days are purged; only aggregated scores and outcomes are kept long-term.

---

## 3. Signal Engine

### 3.1 Composite Score (0–100)

Every token that passes the disqualifier filter is scored across four categories. Weights are configurable in `/settings` and stored in Supabase so the backtester can replay different weight configurations.

#### Category 1 — Smart Money (30 pts)

| Signal | Max pts | Logic |
|---|---|---|
| # of tracked smart wallets that bought | 15 | 1 wallet = 5pts, 2 = 10pts, 3+ = 15pts |
| Recency of first smart money entry | 10 | < 2 min ago = 10, < 10 min = 6, < 30 min = 2 |
| Tracked wallet win rate | 5 | > 65% win rate = 5pts, > 50% = 3pts |

**Error-rate reducer:** If all buying wallets share the same funding source or were created within 24h of each other, cluster penalty of -10 pts (coordinated shill detection).

#### Category 2 — Token Health (25 pts)

| Signal | Max pts | Logic |
|---|---|---|
| LP locked or burned | 8 | Burned = 8, locked ≥ 6 months = 6, locked < 6 months = 3 |
| Mint authority renounced | 5 | Yes = 5, No = 0 |
| Freeze authority disabled | 5 | Yes = 5, No = 0 |
| Dev wallet holding % | 7 | < 2% = 7, < 5% = 4, < 10% = 1, ≥ 10% = 0 |

**Error-rate reducers:**
- Bundled launch detected → -15 pts
- Sniper wallets in first 20 buyers → -1 pt per sniper (max -10)
- Pre-launch insider wallets detected → -10 pts

#### Category 3 — Momentum & Traction (25 pts)

| Signal | Max pts | Logic |
|---|---|---|
| Volume / Market cap ratio | 8 | > 0.5 = 8, > 0.2 = 5, > 0.05 = 2 |
| Holder growth rate | 7 | > 10 new holders/min = 7, > 5/min = 4, > 1/min = 1 |
| Buy/sell ratio (last 10 min) | 5 | > 3:1 = 5, > 2:1 = 3, > 1.5:1 = 1 |
| Social links valid (Twitter + Telegram live) | 3 | Both live = 3, one live = 1 |
| Pump.fun → Raydium migration complete | 2 | Yes = 2 |

**Error-rate reducers:**
- Wash trading detected (same wallet cycling buys/sells) → -8 pts
- Volume spike with no new unique wallets → -5 pts (bot activity flag)

#### Category 4 — Deployer History (20 pts)

| Signal | Max pts | Logic |
|---|---|---|
| Previous token outcome history | 10 | > 60% runners/moonshots = 10, > 40% = 5, first launch = 3 |
| Deployer wallet age | 5 | > 90 days = 5, > 30 days = 3, < 7 days = 0 |
| Deployer SOL balance | 5 | > 5 SOL = 5, > 1 SOL = 3, < 0.5 SOL = 0 |

#### Bonus — Social & Narrative Signal (0–5 pts, optional)

This is a **bonus modifier** added on top of the 0–100 score, capped at 100. It is toggled on/off in `/settings` and defaults to **on**. It does not affect the weights of the four core categories. Its purpose is purely to surface traction context — knowing a token is riding a hot narrative or has a live, growing community slightly elevates an otherwise borderline score.

All sources are free.

| Signal | Max bonus pts | Source | Logic |
|---|---|---|---|
| Trending narrative match | 2 | Configurable keyword list | Token name/description contains keywords matching current hot metas (e.g. "AI", "TRUMP", "DOG", "PEPE", "RWA"). List is editable in Settings. |
| Token Telegram group size + growth | 2 | Telegram Bot API (free) | Group exists and is public: +0.5. Members > 500: +1. Members growing > 50/hour: +0.5 additional. |
| CoinGecko trending presence | 1 | CoinGecko free API | Token appears in `/search/trending` endpoint (top 7 on CG): +1 pt. Rare for new launches — high signal when it fires. |

**What it does NOT include:**
- X/Twitter API (paid — too expensive for $0 budget)
- Sentiment scoring or NLP on social posts (too compute-heavy)
- Real-time Telegram channel monitoring across external channels (privacy/rate-limit issues)

**Lunarcrush note:** Lunarcrush free tier covers established tokens with CoinGecko listings. For brand-new Pump.fun launches (< 1 hour old) it returns no data, so it is excluded. The CoinGecko trending check covers the cases where a token has gained enough traction to appear there.

### 3.2 Hard Disqualifiers

Applied before scoring. Any match → token is tagged `DISQUALIFIED` and shown greyed-out in the feed with the reason.

1. Top-10 wallets hold > 70% of supply
2. Sniper wallets hold > 30% of supply
3. Dev wallet has already sold > 50% of allocation
4. Same deployer address rugged 2 or more previous tokens
5. Bundled launch detected (coordinated multi-wallet first buy within same block)
6. Mint authority NOT renounced on a token older than 10 minutes

### 3.3 Outcome Tier Classification

Tokens are classified at the time they are scored and re-classified as their price evolves. Used for both the live feed display and the backtester ground truth.

| Tier | Price change from entry | Display |
|---|---|---|
| 🚀 MOONSHOT | ≥ 10x | Neon green, top of feed |
| 🏃 RUNNER | 3x – 10x | Green |
| 📈 MODERATE PUMP | 1.5x – 3x | Amber |
| 😐 FLAT | -20% to +50% | Grey |
| 📉 DUMP | -20% to -70% | Orange-red |
| 💀 RUG | < -70% | Red, greyed out |

---

## 4. Dynamic Exit Monitoring

When a paper or real position is logged, the exit monitor polls Jupiter price every 30 seconds and checks:

| Trigger | Action |
|---|---|
| Price ≥ 10x entry | Urgent Telegram alert: "🚀 MOONSHOT — WOJAK is 10x. Exit now?" |
| Price ≥ 3x entry | Telegram alert: "🏃 RUNNER — WOJAK hit 3x" |
| Price ≥ 1.5x entry | Soft Telegram alert: "📈 WOJAK up 1.5x" |
| Price drops to entry + 0.5% | Urgent Telegram: "⚠️ BREAK-EVEN — WOJAK back at entry. Cut?" |
| Price drops to configurable stop-loss (default -30%) | Telegram: "💀 STOP-LOSS triggered on WOJAK" |

Break-even is defined as: `entry_price × 1.005` (covers ~0.5% in swap fees). This is the floor below which the trade is a loss.

---

## 5. Paper Trading Mode

Paper trading is a first-class feature, not a simulation mode. It uses the identical position tracking and exit monitoring infrastructure as real trades.

**Flow:**
1. Token appears in live feed with score ≥ threshold (configurable, default 70)
2. User clicks **"Paper Buy"** in the feed row or token detail panel
3. App records: mint address, token symbol, entry price (Jupiter spot at that instant), entry timestamp, signal score at entry, source (Pump.fun / Raydium / trending)
4. Position appears in `/positions` with a `PAPER` badge
5. Exit monitor watches it identically to a real position
6. User clicks **"Paper Sell"** when they would have exited — app records exit price and calculates outcome tier

**Performance Report** (visible at `/backtester` under "Forward Test" tab):

- Win rate by score bucket (60–70, 70–80, 80–90, 90–100)
- Average return per tier
- Average hold time before exit
- Break-even alert accuracy (% of losing trades where alert fired before bottom)
- Best and worst paper trades with full signal breakdown
- Recommended minimum score threshold based on observed win rates

This report is the primary tool for deciding when to move from paper → real trading.

---

## 6. Pages & Routes

### `/dashboard` — Live Token Feed
- Real-time feed of all scored tokens, updated via Supabase Realtime
- Filter bar: Source (All / Pump.fun / Raydium / Trending) · Min score slider · Tier filter
- Each row: token symbol + mint (truncated) · source badge · age · market cap · score pill (colour-coded) · tier badge · smart money count · "Paper Buy" button
- Disqualified tokens shown collapsed at bottom with reason on hover
- Clicking a row opens a right-side detail panel (no page navigation needed)

### `/tokens/[mint]` — Token Deep-Dive
- Header: symbol, full mint address (copy button), age, source, DexScreener link, GMGN link
- TradingView Lightweight Chart (price + volume, 1m candles)
- Score breakdown: all 4 categories with individual signal values
- Top 10 holders table (address, % held, wallet age, known label if any)
- Recent transactions feed (buy/sell, wallet, USD value, time)
- Deployer history: all previous tokens launched by same address with outcomes
- Risk flags panel: lists all signals that docked points or triggered disqualifiers

### `/wallets` — Smart Money Tracker
- Table of tracked smart wallets: label, address, win rate, estimated PnL (last 30 days), top traded tokens, last active
- Live transaction feed across all tracked wallets (most recent at top)
- Each tx: wallet label · buy/sell · token · USD value · DEX · time
- Add wallet input: paste Solana address + optional label → Helius webhook auto-registers
- Remove wallet → webhook de-registered

### `/positions` — Position Tracker
- Toggle: **Paper | Real** (default: Paper during testing phase)
- Each position card: token · entry price · current price · P&L % · hold time · tier badge · "Sell" button
- Break-even alert shown inline as a pulsing amber border when price is within 5% of entry
- Position history table at bottom: all closed trades with entry/exit/outcome

### `/backtester` — Signal Backtester
Two tabs:

**Historical Replay tab:**
- Uses token data collected by SolBeam itself since installation (stored in `score_history`)
- A one-time bootstrap script seeds initial data via Helius historical tx queries for the Pump.fun program address (covering the past 7–14 days of launches)
- Applies current signal weights to tokens at their recorded launch-time metrics
- Compares predicted tier vs actual peak price outcome
- Output: confusion matrix, win rate by tier, precision/recall per category
- "Tune weights" panel: sliders for each category weight, re-runs instantly
- Note: during week 1 before sufficient data accumulates, rely on the Forward Test tab as the primary calibration tool

**Forward Test tab:**
- Shows performance report from all paper trades logged so far
- Win rate by score bucket, avg return, break-even alert accuracy
- "Recommended threshold" calculated from data

### `/settings` — Configuration
- Signal weights: sliders for Smart Money (30 default), Token Health (25), Momentum (25), Deployer (20) — must sum to 100
- **Social & Narrative Signal toggle** (default: on) — enables the 0–5 pt bonus modifier
- **Narrative keyword list** — editable list of hot meta keywords (e.g. "AI", "TRUMP", "DOG"). Tokens whose name/description matches get +2 pts. Updated manually as metas shift.
- Minimum score alert threshold (default 70) — only tokens above this trigger Telegram
- Take-profit tiers: configurable multipliers (default 1.5x / 3x / 10x)
- Stop-loss threshold (default -30%, toggle on/off)
- Break-even fee assumption (default 0.5%)
- Telegram bot token + chat ID
- Tracked wallet list management (also accessible from /wallets)
- Data retention: how many days of raw tx data to keep (default 30)

---

## 7. Database Schema

```sql
-- Scored tokens
CREATE TABLE tokens (
  mint text PRIMARY KEY,
  symbol text,
  name text,
  source text CHECK (source IN ('pump_fun', 'raydium', 'trending')),
  score integer CHECK (score BETWEEN 0 AND 100),
  disqualified boolean DEFAULT false,
  disqualify_reason text,
  tier text CHECK (tier IN ('MOONSHOT','RUNNER','MODERATE_PUMP','FLAT','DUMP','RUG')),
  price_usd numeric,
  market_cap_usd numeric,
  volume_24h_usd numeric,
  liquidity_usd numeric,
  holder_count integer,
  lp_locked boolean,
  mint_renounced boolean,
  freeze_disabled boolean,
  dev_wallet_pct numeric,
  smart_money_count integer,
  deployer_address text,
  score_breakdown jsonb,   -- full per-signal breakdown for deep-dive page
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Smart money wallets
CREATE TABLE tracked_wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address text UNIQUE NOT NULL,
  label text,
  win_rate numeric,
  estimated_pnl_usd numeric,
  helius_webhook_id text,
  created_at timestamptz DEFAULT now()
);

-- On-chain transactions from tracked wallets
CREATE TABLE wallet_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text NOT NULL,
  signature text UNIQUE NOT NULL,
  type text CHECK (type IN ('buy','sell','transfer')),
  token_mint text,
  token_symbol text,
  amount_usd numeric,
  dex text,
  timestamp timestamptz NOT NULL
);

-- Paper and real positions
CREATE TABLE positions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token_mint text REFERENCES tokens(mint),
  token_symbol text,
  mode text CHECK (mode IN ('paper','real')) DEFAULT 'paper',
  entry_price_usd numeric NOT NULL,
  entry_timestamp timestamptz DEFAULT now(),
  entry_score integer,
  exit_price_usd numeric,
  exit_timestamp timestamptz,
  outcome_tier text,
  pnl_pct numeric,
  status text CHECK (status IN ('open','closed')) DEFAULT 'open',
  notes text
);

-- Score history for backtesting calibration
CREATE TABLE score_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token_mint text,
  score integer,
  score_breakdown jsonb,
  weights_snapshot jsonb,   -- signal weights active at time of scoring
  actual_outcome text,      -- filled in later when outcome is known
  peak_multiplier numeric,  -- highest price / entry price
  recorded_at timestamptz DEFAULT now()
);

-- Settings (single row, personal tool)
CREATE TABLE settings (
  id integer PRIMARY KEY DEFAULT 1,
  signal_weights jsonb DEFAULT '{"smart_money":30,"token_health":25,"momentum":25,"deployer":20}',
  min_alert_score integer DEFAULT 70,
  take_profit_tiers jsonb DEFAULT '[1.5, 3.0, 10.0]',
  stop_loss_pct numeric DEFAULT 30,
  break_even_fee_pct numeric DEFAULT 0.5,
  telegram_bot_token text,
  telegram_chat_id text,
  data_retention_days integer DEFAULT 30
);
```

---

## 8. Project Structure

```
solbeam/
├── app/
│   ├── dashboard/            # Live feed page
│   ├── tokens/[mint]/        # Token deep-dive
│   ├── wallets/              # Smart money tracker
│   ├── positions/            # Position tracker (paper + real)
│   ├── backtester/           # Historical replay + forward test report
│   ├── settings/             # Config page
│   └── api/
│       ├── webhooks/helius/  # Helius webhook ingest
│       ├── cron/scan/        # DexScreener poll (Vercel cron)
│       ├── positions/        # CRUD for positions
│       └── tokens/[mint]/    # Token data + score endpoint
├── components/
│   ├── feed/                 # TokenRow, FeedFilter, ScorePill, TierBadge
│   ├── token/                # ScoreBreakdown, HolderTable, TxFeed, RiskPanel
│   ├── positions/            # PositionCard, ExitMonitor, PnLBadge
│   ├── wallets/              # WalletRow, WalletTxFeed, AddWalletForm
│   ├── backtester/           # HistoricalReplay, ForwardTestReport, WeightSliders
│   └── layout/               # Sidebar, TopBar, NotificationBell
├── lib/
│   ├── signal-engine.ts      # Composite score calculator
│   ├── disqualifiers.ts      # Hard veto rules
│   ├── exit-monitor.ts       # Break-even + take-profit logic
│   ├── helius.ts             # RPC + webhook helpers
│   ├── dexscreener.ts        # New pair polling + OHLCV
│   ├── jupiter.ts            # Live price feed
│   ├── supabase.ts           # DB client (server + browser)
│   ├── redis.ts              # Upstash cache helpers
│   └── telegram.ts           # Alert delivery
├── supabase/
│   └── migrations/           # SQL schema files
└── docs/
    └── superpowers/specs/
        └── 2026-04-26-solbeam-design.md
```

---

## 9. Implementation Order

Build in this sequence to enable testing at each stage:

1. **Data pipeline** — DexScreener polling + Helius webhook ingest + Supabase storage
2. **Signal engine** — Score calculator + disqualifiers (no UI yet, test via API)
3. **Live feed UI** — Dashboard page with real-time scored token rows
4. **Paper trading** — Positions page with paper buy/sell + exit monitor + Telegram alerts
5. **Token deep-dive** — /tokens/[mint] page with full signal breakdown
6. **Wallet tracker** — /wallets page + Helius webhook management
7. **Backtester** — Historical replay tab + forward test report tab
8. **Settings** — Weight tuning + alert configuration

Steps 1–4 are the testable MVP. You can begin paper trading within the first week and start accumulating signal performance data immediately.

---

## 10. What Makes SolBeam Better Than Karoshi.fun

| Feature | Karoshi.fun | SolBeam |
|---|---|---|
| Token discovery | Pump.fun only | Pump.fun + Raydium + trending (all DEXes) |
| Signal depth | Market sentiment gauge (simple ratio) | 4-category composite score with 15+ signals + optional social/narrative bonus |
| Smart money tracking | None | Real-time via Helius webhooks, curated wallet list |
| Rug/risk detection | Basic outcome logging | 6 hard disqualifiers + per-signal docking |
| Deployer history | None | Full previous token outcome analysis |
| Position tracking | None | Paper + real positions with live P&L |
| Break-even alerts | None | Real-time price monitor → Telegram alert |
| Social/news signal | None | Telegram group velocity + CoinGecko trending + narrative keyword match (optional, free) |
| Backtesting | None | Historical replay + forward paper trade report |
| Personalisation | None (shared dashboard) | Personal instance, configurable weights + thresholds |
| Cost | Paid (Whop subscription) | $0/month |
