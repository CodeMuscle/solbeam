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

  it('classifies source as pump_fun when dexId is pumpfun', () => {
    const pumpPair = { ...fakePair, dexId: 'pumpfun' }
    const token = normalizeDexPairToToken(pumpPair, 'trending')
    expect(token.source).toBe('pump_fun')
  })

  it('falls back to provided source when dexId is unknown', () => {
    const otherPair = { ...fakePair, dexId: 'orca' }
    const token = normalizeDexPairToToken(otherPair, 'trending')
    expect(token.source).toBe('trending')
  })

  it('defaults score to 0 and disqualified to false', () => {
    const token = normalizeDexPairToToken(fakePair, 'raydium')
    expect(token.score).toBe(0)
    expect(token.disqualified).toBe(false)
  })

  it('disqualifies tokens with mcap below $5k', () => {
    const tinyPair = { ...fakePair, marketCap: 1000 }
    const token = normalizeDexPairToToken(tinyPair, 'raydium')
    expect(token.disqualified).toBe(true)
    expect(token.disqualify_reason).toContain('Market cap below $5k')
  })

  it('disqualifies tokens that dumped >70% in 24h', () => {
    const dumpedPair = { ...fakePair, priceChange: { h24: -80 } }
    const token = normalizeDexPairToToken(dumpedPair, 'raydium')
    expect(token.disqualified).toBe(true)
    expect(token.disqualify_reason).toContain('dumped')
  })

  it('classifies tier from h24 price change', () => {
    const moonPair = { ...fakePair, priceChange: { h24: 1000 } }
    const runnerPair = { ...fakePair, priceChange: { h24: 200 } }
    const flatPair = { ...fakePair, priceChange: { h24: 5 } }
    expect(normalizeDexPairToToken(moonPair, 'raydium').tier).toBe('MOONSHOT')
    expect(normalizeDexPairToToken(runnerPair, 'raydium').tier).toBe('RUNNER')
    expect(normalizeDexPairToToken(flatPair, 'raydium').tier).toBe('FLAT')
  })
})
