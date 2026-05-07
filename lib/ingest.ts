import type { DexPair } from './dexscreener'
import type { Token, TokenSource, OutcomeTier } from './types'
import { redis, CACHE_TTL } from './redis'

function classifySource(pair: DexPair, fallback: TokenSource): TokenSource {
  if (pair.dexId === 'pumpfun' || pair.dexId === 'pump-fun') return 'pump_fun'
  if (pair.dexId === 'raydium') return 'raydium'
  return fallback
}

function classifyLiveTier(pair: DexPair): OutcomeTier | null {
  const h24 = pair.priceChange?.h24
  if (h24 === undefined || h24 === null) return null
  const multiplier = 1 + h24 / 100
  if (multiplier >= 10) return 'MOONSHOT'
  if (multiplier >= 3) return 'RUNNER'
  if (multiplier >= 1.5) return 'MODERATE_PUMP'
  if (multiplier >= 0.8) return 'FLAT'
  if (multiplier > 0.3) return 'DUMP'
  return 'RUG'
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
