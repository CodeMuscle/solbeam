# 🔆 Solbeam

> Cut through the noise. Real-time Solana DeFi intelligence — track smart money, scan tokens, and catch signals before the crowd.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-green?logo=supabase)
![Solana](https://img.shields.io/badge/Solana-purple?logo=solana)
![Cost](https://img.shields.io/badge/infra%20cost-%240–5%2Fmo-brightgreen)

---

## What is Solbeam?

Solbeam is an open-source, self-hostable Solana DeFi intelligence dashboard. It shines a beam of light on on-chain activity — new token launches, smart wallet movements, whale alerts, and token risk scoring — all in one clean, fast interface.

Built as a direct alternative to tools like karoshi.fun, GMGN, and Birdeye, but with a zero-cost infrastructure approach that lets you ship a full MVP for free.

---

## Screenshots

> _Coming soon — dashboard, token detail page, wallet tracker, and alerts._

---

## Features

### 🔴 Live Token Feed
- Real-time new token launches from Pump.fun, Raydium, and Jupiter
- Price, volume, market cap, liquidity, and token age at a glance
- Rug risk scoring — holder concentration, LP lock status, mint authority flags

### 🐋 Smart Wallet Tracker
- Add any Solana wallet address to your watchlist
- Live transaction feed powered by Helius webhooks (no polling)
- Classify every trade — buy/sell, token, USD value, DEX used
- Follow known whale wallets and smart money

### 📊 Token Deep-Dive
- TradingView Lightweight Charts for price + volume history
- Top holder distribution (top 10 / 25 breakdown)
- Recent on-chain transactions feed
- Risk assessment panel with go/no-go signal

### 🔔 Alerts Engine
- Set custom alerts on price thresholds, volume spikes, whale buys, and new wallet entries
- Delivered via in-app notifications, email (Resend), and Telegram bot
- No polling — push-based via Helius webhooks

### 🤖 AI Signal Summary _(optional)_
- Claude API integration to summarise what smart money is doing
- Example: _"3 whale wallets entered $BONK in the last 2 hours — possible momentum setup"_

### 🏆 Smart Money Leaderboard
- Curated list of consistently profitable wallets
- Win rate, estimated PnL, most traded tokens
- One-click follow to add to your watchlist

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | Shadcn/UI + Tailwind CSS |
| Database | Supabase (Postgres + Realtime) |
| Auth | Supabase Auth |
| Cache | Upstash Redis (free tier) |
| Solana RPC | Helius (free tier — 1M credits/mo) |
| Token Prices | Jupiter Price API (free) |
| Token Analytics | DexScreener API (free) |
| Charts | TradingView Lightweight Charts |
| Email | Resend (free tier — 3k/mo) |
| Deployment | Vercel (Hobby — free) |

**Estimated infrastructure cost: $0–5/month for a full MVP.**

---

## Data Sources (All Free)

| Source | What It Provides |
|---|---|
| [Helius](https://helius.dev) | Parsed transactions, webhooks, wallet history, token metadata (DAS API) |
| [Jupiter Price API](https://station.jup.ag/docs/apis/price-api) | Real-time SPL token prices |
| [DexScreener API](https://docs.dexscreener.com) | Token pairs, volume, liquidity, OHLCV, new pairs |
| [Solscan](https://solscan.io) | Holder data, token supply info |

No Birdeye. No paid RPC. No expensive analytics subscriptions.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free)
- A [Helius](https://helius.dev) API key (free)
- A [Vercel](https://vercel.com) account (free)
- An [Upstash](https://upstash.com) Redis database (free)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/solbeam
cd solbeam
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Helius
HELIUS_API_KEY=your_helius_api_key
HELIUS_WEBHOOK_SECRET=your_webhook_secret

# Upstash Redis
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Resend (email alerts)
RESEND_API_KEY=your_resend_key

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Claude AI (optional — for AI signal summaries)
ANTHROPIC_API_KEY=your_anthropic_key
```

### 3. Run the database migrations

```bash
npx supabase db push
```

Or apply the SQL manually from `/supabase/migrations/`.

### 4. Register your Helius webhook

Point Helius to your deployment URL:

```
https://yourapp.vercel.app/api/webhooks/helius
```

Set it to listen for **enhanced transaction** events on your tracked wallet addresses.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
solbeam/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/          # Main live feed
│   ├── tokens/
│   │   └── [mint]/         # Token deep-dive page
│   ├── wallets/
│   │   └── [address]/      # Wallet detail page
│   ├── alerts/             # Alert management
│   └── leaderboard/        # Smart money list
├── components/
│   ├── charts/             # TradingView + Recharts wrappers
│   ├── tokens/             # TokenCard, RiskBadge, HolderChart
│   ├── wallets/            # WalletFeed, WalletCard, TxRow
│   └── alerts/             # AlertForm, AlertList, NotificationBell
├── lib/
│   ├── helius.ts           # RPC + webhook helpers
│   ├── jupiter.ts          # Price feed
│   ├── dexscreener.ts      # Token pair data
│   ├── supabase.ts         # DB client (server + browser)
│   └── redis.ts            # Upstash cache helpers
├── api/
│   ├── webhooks/
│   │   └── helius/         # Ingest live transactions → DB + alerts
│   ├── tokens/
│   │   └── [mint]/         # Token data endpoint
│   └── alerts/             # CRUD for user alerts
└── supabase/
    └── migrations/         # DB schema SQL
```

---

## Database Schema

```sql
-- Tracked wallets per user
CREATE TABLE tracked_wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  wallet_address text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now()
);

-- Live transaction feed
CREATE TABLE transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text NOT NULL,
  signature text UNIQUE NOT NULL,
  type text CHECK (type IN ('buy', 'sell', 'transfer')),
  token_mint text,
  token_symbol text,
  amount_usd numeric,
  dex text,
  timestamp timestamptz NOT NULL
);

-- Token metadata cache
CREATE TABLE tokens (
  mint text PRIMARY KEY,
  name text,
  symbol text,
  price_usd numeric,
  volume_24h numeric,
  market_cap numeric,
  liquidity_usd numeric,
  holder_count integer,
  risk_score integer CHECK (risk_score BETWEEN 0 AND 100),
  updated_at timestamptz DEFAULT now()
);

-- User alerts
CREATE TABLE alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  type text CHECK (type IN ('price', 'whale', 'new_entry', 'volume')),
  token_mint text,
  wallet_address text,
  threshold numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- In-app notifications
CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  alert_id uuid REFERENCES alerts(id),
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## How the Webhook Pipeline Works

```
Helius detects tx on tracked wallet
        ↓
POST /api/webhooks/helius
        ↓
Parse: buy/sell/transfer + token + USD value
        ↓
Insert into transactions table
        ↓
Check against active user alerts
        ↓
Match? → Queue notification
        ↓
Supabase Realtime broadcast → live UI update
        ↓
Email via Resend + Telegram bot (if enabled)
```

---

## Upgrade Path

Solbeam is designed to scale with you — zero changes needed to the architecture.

| Stage | Users | Monthly Cost | What to upgrade |
|---|---|---|---|
| MVP | 0–100 | **$0** | Nothing |
| Growing | 100–500 | **~$25** | Supabase Pro (more DB + bandwidth) |
| Revenue | 500+ | **~$75** | Helius Growth + Supabase Pro |
| Scale | 1000+ | Self-sustaining | Revenue covers infra comfortably |

At just **4–8 paying subscribers at $10–20/mo**, the app covers all infrastructure costs.

---

## Roadmap

- [x] Project scaffolding + DB schema
- [ ] Auth (Supabase email/password)
- [ ] Live token feed (DexScreener + Jupiter)
- [ ] Wallet tracker (Helius webhooks)
- [ ] Token deep-dive page
- [ ] Risk scoring engine
- [ ] Alerts system (in-app + email)
- [ ] Telegram bot integration
- [ ] Smart money leaderboard
- [ ] AI signal summaries (Claude API)
- [ ] Public wallet pages
- [ ] Tiered access / paywall

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

1. Fork the repo
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT — do whatever you want, just don't blame us if you get rekt on-chain.

---

<div align="center">
  <sub>Built with 🔆 by someone tired of paying $99/mo for DeFi data that should be free.</sub>
</div>
