-- ============================================================
-- SolBeam — Token social/web metadata + pump.fun bonding %
-- ============================================================

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS socials jsonb;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS websites jsonb;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS bonding_curve_pct numeric;
