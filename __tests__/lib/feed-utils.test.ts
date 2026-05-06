import {
  scoreToColor,
  scoreToTextColor,
  filterTokens,
  type FeedFilters,
} from '@/lib/feed-utils'
import type { Token } from '@/lib/types'

function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    mint: 'mint123',
    symbol: 'WOJAK',
    name: 'Wojak Coin',
    source: 'raydium',
    score: 75,
    disqualified: false,
    disqualify_reason: null,
    tier: 'RUNNER',
    price_usd: 0.001,
    market_cap_usd: 100000,
    volume_24h_usd: 50000,
    liquidity_usd: 25000,
    holder_count: 500,
    lp_locked: true,
    mint_renounced: true,
    freeze_disabled: true,
    dev_wallet_pct: 2,
    smart_money_count: 2,
    deployer_address: 'deployer1',
    score_breakdown: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('scoreToColor', () => {
  it('returns green background for score >= 80', () => {
    expect(scoreToColor(80)).toContain('green')
    expect(scoreToColor(95)).toContain('green')
  })

  it('returns amber background for score 60–79', () => {
    expect(scoreToColor(60)).toContain('amber')
    expect(scoreToColor(79)).toContain('amber')
  })

  it('returns red background for score < 60', () => {
    expect(scoreToColor(40)).toContain('red')
    expect(scoreToColor(59)).toContain('red')
  })
})

describe('filterTokens', () => {
  const tokens = [
    makeToken({ source: 'pump_fun', score: 85, tier: 'MOONSHOT' }),
    makeToken({ mint: 'mint2', source: 'raydium', score: 65, tier: 'RUNNER' }),
    makeToken({ mint: 'mint3', source: 'trending', score: 45, tier: 'FLAT' }),
    makeToken({ mint: 'mint4', disqualified: true, score: 0 }),
  ]

  const defaultFilters: FeedFilters = { source: 'all', minScore: 0, tier: 'all' }

  it('returns all non-disqualified tokens with default filters', () => {
    const result = filterTokens(tokens, defaultFilters)
    expect(result.qualified).toHaveLength(3)
    expect(result.disqualified).toHaveLength(1)
  })

  it('filters by source', () => {
    const result = filterTokens(tokens, { ...defaultFilters, source: 'pump_fun' })
    expect(result.qualified).toHaveLength(1)
    expect(result.qualified[0].source).toBe('pump_fun')
  })

  it('filters by minimum score', () => {
    const result = filterTokens(tokens, { ...defaultFilters, minScore: 70 })
    expect(result.qualified).toHaveLength(1)
    expect(result.qualified[0].score).toBe(85)
  })

  it('filters by tier', () => {
    const result = filterTokens(tokens, { ...defaultFilters, tier: 'RUNNER' })
    expect(result.qualified).toHaveLength(1)
    expect(result.qualified[0].tier).toBe('RUNNER')
  })

  it('always shows disqualified tokens regardless of filters', () => {
    const result = filterTokens(tokens, { ...defaultFilters, minScore: 90 })
    expect(result.disqualified).toHaveLength(1)
  })
})
