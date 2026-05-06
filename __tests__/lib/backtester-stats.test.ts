import {
  computeForwardTestStats,
  groupByScoreBucket,
  type ClosedPosition,
} from '@/lib/backtester-stats'

function makePosition(overrides: Partial<ClosedPosition> = {}): ClosedPosition {
  return {
    id: 'pos1',
    entry_score: 75,
    pnl_pct: 150,
    outcome_tier: 'RUNNER',
    entry_timestamp: new Date().toISOString(),
    exit_timestamp: new Date().toISOString(),
    mode: 'paper',
    ...overrides,
  }
}

describe('groupByScoreBucket', () => {
  it('groups positions into correct 10-point buckets', () => {
    const positions = [
      makePosition({ entry_score: 65 }),
      makePosition({ entry_score: 72 }),
      makePosition({ entry_score: 85 }),
      makePosition({ entry_score: 92 }),
    ]
    const groups = groupByScoreBucket(positions)
    expect(groups['60-70']).toHaveLength(1)
    expect(groups['70-80']).toHaveLength(1)
    expect(groups['80-90']).toHaveLength(1)
    expect(groups['90-100']).toHaveLength(1)
  })

  it('ignores positions with null entry_score', () => {
    const positions = [makePosition({ entry_score: null as unknown as number })]
    const groups = groupByScoreBucket(positions)
    const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0)
    expect(total).toBe(0)
  })
})

describe('computeForwardTestStats', () => {
  it('returns empty array for no positions', () => {
    const stats = computeForwardTestStats([])
    expect(stats).toEqual([])
  })

  it('computes correct win rate for a bucket', () => {
    const positions = [
      makePosition({ entry_score: 75, pnl_pct: 200, outcome_tier: 'RUNNER' }),
      makePosition({ entry_score: 78, pnl_pct: -15, outcome_tier: 'FLAT' }),
      makePosition({ entry_score: 71, pnl_pct: 80, outcome_tier: 'MODERATE_PUMP' }),
    ]
    const stats = computeForwardTestStats(positions)
    const bucket = stats.find((s) => s.bucket === '70-80')!
    expect(bucket.count).toBe(3)
    expect(bucket.winRate).toBeCloseTo(2 / 3)
    expect(bucket.avgReturnPct).toBeCloseTo((200 + -15 + 80) / 3)
  })

  it('marks a trade as a win when pnl_pct > 0', () => {
    const positions = [makePosition({ entry_score: 85, pnl_pct: 1 })]
    const stats = computeForwardTestStats(positions)
    expect(stats[0].winRate).toBe(1)
  })

  it('marks a trade as a loss when pnl_pct <= 0', () => {
    const positions = [makePosition({ entry_score: 85, pnl_pct: 0 })]
    const stats = computeForwardTestStats(positions)
    expect(stats[0].winRate).toBe(0)
  })

  it('returns buckets sorted from highest score to lowest', () => {
    const positions = [
      makePosition({ entry_score: 65, pnl_pct: 10 }),
      makePosition({ entry_score: 92, pnl_pct: 500 }),
    ]
    const stats = computeForwardTestStats(positions)
    expect(stats[0].bucket).toBe('90-100')
    expect(stats[1].bucket).toBe('60-70')
  })
})
