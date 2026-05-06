-- ============================================================
-- SolBeam — Initial Schema
-- ============================================================

-- Scored tokens (main table — Realtime enabled after creation)
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
  smart_money_count integer DEFAULT 0,
  deployer_address text,
  score_breakdown jsonb,
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
  weights_snapshot jsonb,
  actual_outcome text,
  peak_multiplier numeric,
  recorded_at timestamptz DEFAULT now()
);

-- Settings (single-row personal config)
CREATE TABLE settings (
  id integer PRIMARY KEY DEFAULT 1,
  signal_weights jsonb DEFAULT '{"smart_money":30,"token_health":25,"momentum":25,"deployer":20}',
  social_signal_enabled boolean DEFAULT true,
  narrative_keywords text[] DEFAULT ARRAY['AI','TRUMP','DOG','PEPE','RWA','MEME','CAT'],
  min_alert_score integer DEFAULT 70,
  take_profit_tiers jsonb DEFAULT '[1.5, 3.0, 10.0]',
  stop_loss_pct numeric DEFAULT 30,
  break_even_fee_pct numeric DEFAULT 0.5,
  telegram_bot_token text,
  telegram_chat_id text,
  data_retention_days integer DEFAULT 30
);

-- Seed the default settings row
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_tokens_score ON tokens(score DESC);
CREATE INDEX idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX idx_tokens_disqualified ON tokens(disqualified);
CREATE INDEX idx_tokens_source ON tokens(source);
CREATE INDEX idx_wallet_txs_wallet ON wallet_transactions(wallet_address);
CREATE INDEX idx_wallet_txs_timestamp ON wallet_transactions(timestamp DESC);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_score_history_recorded_at ON score_history(recorded_at DESC);

-- ============================================================
-- updated_at trigger for tokens table
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Data retention helper (call via Supabase dashboard cron)
-- ============================================================

CREATE OR REPLACE FUNCTION purge_old_transactions()
RETURNS void AS $$
DECLARE
  retention integer;
BEGIN
  SELECT data_retention_days INTO retention FROM settings WHERE id = 1;
  DELETE FROM wallet_transactions
  WHERE timestamp < now() - (retention || ' days')::interval;
END;
$$ language 'plpgsql';
