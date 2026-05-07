-- ============================================================
-- SolBeam — Add pair_created_at and supporting indices
-- ============================================================

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS pair_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tokens_pair_created_at ON tokens(pair_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_liquidity ON tokens(liquidity_usd DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume_24h_usd DESC);
