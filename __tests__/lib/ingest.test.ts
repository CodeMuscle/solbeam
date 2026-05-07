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

  it('classifies MOONSHOT only when 24h up >300% AND momentum confirms', () => {
    const moonPair = {
      ...fakePair,
      priceChange: { h24: 500, h6: 50, h1: 10 },
      volume: { h24: 500_000 },
      liquidity: { usd: 50_000 },
      txns: { h1: { buys: 100, sells: 30 } },
    }
    expect(normalizeDexPairToToken(moonPair, 'raydium').tier).toBe('MOONSHOT')
  })

  it('downgrades a 24h pump that is reversing in last hour', () => {
    const reversingPair = {
      ...fakePair,
      priceChange: { h24: 500, h6: 0, h1: -25 },
      volume: { h24: 500_000 },
      liquidity: { usd: 50_000 },
    }
    const tier = normalizeDexPairToToken(reversingPair, 'raydium').tier
    expect(tier).not.toBe('MOONSHOT')
  })

  it('classifies RUNNER for 50-300% with healthy volume', () => {
    const runnerPair = {
      ...fakePair,
      priceChange: { h24: 150, h1: -2 },
      volume: { h24: 100_000 },
      liquidity: { usd: 20_000 },
    }
    expect(normalizeDexPairToToken(runnerPair, 'raydium').tier).toBe('RUNNER')
  })

  it('classifies FLAT when 24h change is small', () => {
    const flatPair = { ...fakePair, priceChange: { h24: 5 } }
    expect(normalizeDexPairToToken(flatPair, 'raydium').tier).toBe('FLAT')
  })

  it('classifies RUG when 24h dump > 70%', () => {
    const rugPair = { ...fakePair, priceChange: { h24: -75 } }
    expect(normalizeDexPairToToken(rugPair, 'raydium').tier).toBe('RUG')
  })
})
