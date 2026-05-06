import type { DexPair } from './dexscreener'
import type { Token, TokenSource } from './types'
import { redis, CACHE_TTL } from './redis'

export function normalizeDexPairToToken(
  pair: DexPair,
  source: TokenSource
): Omit<Token, 'created_at' | 'updated_at'> {
  return {
    mint: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    source,
    score: 0,
    disqualified: false,
    disqualify_reason: null,
    tier: null,
    price_usd: parseFloat(pair.priceUsd) || null,
    market_cap_usd: pair.marketCap || null,
    volume_24h_usd: pair.volume.h24 || null,
    liquidity_usd: pair.liquidity.usd || null,
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
