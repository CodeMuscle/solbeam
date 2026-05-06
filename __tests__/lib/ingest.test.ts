import { normalizeDexPairToToken } from '@/lib/ingest'
import type { DexPair } from '@/lib/dexscreener'

const fakePair: DexPair = {
  chainId: 'solana',
  dexId: 'raydium',
  pairAddress: 'pair123',
  baseToken: { address: 'mint123', symbol: 'WOJAK', name: 'Wojak Coin' },
  priceUsd: '0.0012',
  volume: { h24: 50000 },
  liquidity: { usd: 25000 },
  marketCap: 100000,
  pairCreatedAt: Date.now() - 60_000,
}

describe('normalizeDexPairToToken', () => {
  it('maps DexPair fields to Token shape correctly', () => {
    const token = normalizeDexPairToToken(fakePair, 'raydium')
    expect(token.mint).toBe('mint123')
    expect(token.symbol).toBe('WOJAK')
    expect(token.source).toBe('raydium')
    expect(token.price_usd).toBe(0.0012)
    expect(token.market_cap_usd).toBe(100000)
    expect(token.volume_24h_usd).toBe(50000)
    expect(token.liquidity_usd).toBe(25000)
  })

  it('accepts pump_fun and trending as valid sources', () => {
    const t1 = normalizeDexPairToToken(fakePair, 'pump_fun')
    const t2 = normalizeDexPairToToken(fakePair, 'trending')
    expect(t1.source).toBe('pump_fun')
    expect(t2.source).toBe('trending')
  })

  it('defaults score to 0 and disqualified to false', () => {
    const token = normalizeDexPairToToken(fakePair, 'raydium')
    expect(token.score).toBe(0)
    expect(token.disqualified).toBe(false)
  })
})
