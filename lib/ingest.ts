import type { DexPair } from './dexscreener'
import type { Token, TokenSource, OutcomeTier } from './types'
import { redis, CACHE_TTL } from './redis'

function classifySource(pair: DexPair, fallback: TokenSource): TokenSource {
  if (pair.dexId === 'pumpfun' || pair.dexId === 'pump-fun') return 'pump_fun'
  if (pair.dexId === 'raydium') return 'raydium'
  return fallback
}

/**
 * Multi-signal tier classification.
 * A token must satisfy ALL of:
 *   1. Primary 24h move passes the band's threshold
 *   2. Recent momentum (1h) confirms — not faking out
 *   3. Volume + liquidity sanity (no high-tier ratings on illiquid coins)
 *   4. Buy/sell pressure aligns with direction
 */
function classifyLiveTier(pair: DexPair): OutcomeTier | null {
  const h24 = pair.priceChange?.h24
  const h6 = pair.priceChange?.h6
  const h1 = pair.priceChange?.h1
  if (h24 === undefined || h24 === null) return null

  const liq = pair.liquidity?.usd ?? 0
  const vol24 = pair.volume?.h24 ?? 0
  const buys = pair.txns?.h1?.buys ?? 0
  const sells = pair.txns?.h1?.sells ?? 0
  const buySellRatio = sells > 0 ? buys / sells : buys > 0 ? 5 : 1

  // Hard rug detectors (any one triggers RUG)
  if (h24 <= -70) return 'RUG'
  if (liq > 0 && liq < 1500) return 'RUG'
  if (h24 <= -50 && (h1 ?? 0) < -10) return 'RUG'

  // DUMP: down materially with continued weakness
  if (h24 <= -25 || (h24 < -10 && (h1 ?? 0) < -5)) return 'DUMP'

  // MOONSHOT requires:
  //  - >300% over 24h
  //  - h6 still positive (uptrend not reversing)
  //  - h1 not crashing (not actively dumping right now)
  //  - real volume ($250k+ in 24h)
  //  - more buys than sells in last hour
  //  - decent liquidity ($25k+) so it's exitable
  if (
    h24 >= 300 &&
    (h6 ?? 0) > 0 &&
    (h1 ?? 0) > -15 &&
    vol24 >= 250_000 &&
    buySellRatio >= 1.2 &&
    liq >= 25_000
  ) {
    return 'MOONSHOT'
  }

  // RUNNER requires:
  //  - 50–300% over 24h
  //  - momentum continuing OR consolidating (h1 > -10)
  //  - $50k+ in 24h volume
  //  - liquidity > $15k
  if (
    h24 >= 50 &&
    (h1 ?? 0) > -10 &&
    vol24 >= 50_000 &&
    liq >= 15_000
  ) {
    return 'RUNNER'
  }

  // MODERATE_PUMP requires:
  //  - 10–50% over 24h
  //  - some volume
  if (h24 >= 10 && vol24 >= 10_000) return 'MODERATE_PUMP'

  // Anything between -10% and +10% with weak signals = FLAT
  if (h24 >= -10 && h24 < 10) return 'FLAT'

  // Caught between bands (e.g., 50% pump but illiquid) = stricter MODERATE_PUMP fallback
  if (h24 >= 10) return 'MODERATE_PUMP'

  return 'DUMP'
}

function checkLiveDisqualifiers(pair: DexPair): string | null {
  const mcap = pair.marketCap ?? 0
  const liq = pair.liquidity?.usd ?? 0
  const h24 = pair.priceChange?.h24 ?? 0

  if (mcap > 0 && mcap < 5000) return 'Market cap below $5k (likely dead)'
  if (liq > 0 && liq < 1000) return 'Liquidity below $1k (likely dead)'
  if (h24 < -70) return 'Price dumped >70% in 24h (rug)'
  return null
}

// pump.fun tokens graduate at ~$69k mcap. Estimate bonding-curve completion %.
const PUMPFUN_GRADUATION_MCAP = 69_000
function estimateBondingCurvePct(pair: DexPair): number | null {
  if (pair.dexId !== 'pumpfun' && pair.dexId !== 'pump-fun') return null
  const mcap = pair.marketCap ?? 0
  if (mcap <= 0) return 0
  return Math.min(100, Math.round((mcap / PUMPFUN_GRADUATION_MCAP) * 100))
}

export function normalizeDexPairToToken(
  pair: DexPair,
  sourceFallback: TokenSource
): Omit<Token, 'created_at' | 'updated_at'> {
  const dq = checkLiveDisqualifiers(pair)

  return {
    mint: pair.baseToken.address,
    symbol: pair.baseToken.symbol ?? null,
    name: pair.baseToken.name ?? null,
    source: classifySource(pair, sourceFallback),
    score: 0,
    disqualified: dq !== null,
    disqualify_reason: dq,
    tier: classifyLiveTier(pair),
    price_usd: pair.priceUsd ? parseFloat(pair.priceUsd) || null : null,
    market_cap_usd: pair.marketCap ?? null,
    volume_24h_usd: pair.volume?.h24 ?? null,
    liquidity_usd: pair.liquidity?.usd ?? null,
    holder_count: null,
    lp_locked: null,
    mint_renounced: null,
    freeze_disabled: null,
    dev_wallet_pct: null,
    smart_money_count: 0,
    deployer_address: null,
    score_breakdown: null,
    pair_created_at: pair.pairCreatedAt
      ? new Date(pair.pairCreatedAt).toISOString()
      : null,
    socials: pair.info?.socials ?? null,
    websites: pair.info?.websites ?? null,
    image_url: pair.info?.imageUrl ?? null,
    bonding_curve_pct: estimateBondingCurvePct(pair),
  }
}

export async function cacheToken(token: Pick<Token, 'mint'> & Partial<Token>): Promise<void> {
  await redis.setex(`token:${token.mint}`, CACHE_TTL.TOKEN, JSON.stringify(token))
}

export async function getCachedToken(mint: string): Promise<Partial<Token> | null> {
  const cached = await redis.get<string>(`token:${mint}`)
  if (!cached) return null
  return typeof cached === 'string' ? JSON.parse(cached) : cached
}

export async function cachePrice(mint: string, priceUsd: number): Promise<void> {
  await redis.setex(`price:${mint}`, CACHE_TTL.PRICE, priceUsd.toString())
}

export async function getCachedPrice(mint: string): Promise<number | null> {
  const cached = await redis.get<string>(`price:${mint}`)
  if (!cached) return null
  return parseFloat(typeof cached === 'string' ? cached : String(cached))
}
