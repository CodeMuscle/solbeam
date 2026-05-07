import { supabaseAdmin } from './supabase/admin'
import { fetchPrices } from './jupiter'

/**
 * Resolve current USD prices for a set of mints.
 * Primary source: our `tokens` table (updated every cron tick from DexScreener).
 * Fallback: Jupiter Price API for any missing mints.
 */
export async function getCurrentPrices(mints: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (mints.length === 0) return result

  const { data } = await supabaseAdmin
    .from('tokens')
    .select('mint, price_usd')
    .in('mint', mints)

  for (const row of data ?? []) {
    const price = row.price_usd != null ? Number(row.price_usd) : 0
    if (price > 0) result.set(row.mint, price)
  }

  const missing = mints.filter((m) => !result.has(m))
  if (missing.length > 0) {
    try {
      const jupPrices = await fetchPrices(missing)
      for (const [mint, price] of jupPrices) {
        if (price > 0) result.set(mint, price)
      }
    } catch {
      // Jupiter fallback failed — proceed with what we have
    }
  }

  return result
}
