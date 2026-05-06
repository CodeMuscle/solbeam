import type { OutcomeTier } from './types'

export interface ClosedPosition {
  id: string
  entry_score: number
  pnl_pct: number | null
  outcome_tier: OutcomeTier | null
  entry_timestamp: string
  exit_timestamp: string | null
  mode: 'paper' | 'real'
}

export interface ScoreBucketStats {
  bucket: string
  count: number
  winRate: number
  avgReturnPct: number
  bestTrade: number
  worstTrade: number
}

type BucketKey = '60-70' | '70-80' | '80-90' | '90-100' | '<60'

function getBucket(score: number): BucketKey {
  if (score >= 90) return '90-100'
  if (score >= 80) return '80-90'
  if (score >= 70) return '70-80'
  if (score >= 60) return '60-70'
  return '<60'
}

const BUCKET_ORDER: BucketKey[] = ['90-100', '80-90', '70-80', '60-70', '<60']

export function groupByScoreBucket(
  positions: ClosedPosition[]
): Partial<Record<BucketKey, ClosedPosition[]>> {
  const groups: Partial<Record<BucketKey, ClosedPosition[]>> = {}

  for (const pos of positions) {
    if (pos.entry_score == null) continue
    const bucket = getBucket(pos.entry_score)
    if (!groups[bucket]) groups[bucket] = []
    groups[bucket]!.push(pos)
  }

  return groups
}

export function computeForwardTestStats(positions: ClosedPosition[]): ScoreBucketStats[] {
  if (positions.length === 0) return []

  const groups = groupByScoreBucket(positions)
  const stats: ScoreBucketStats[] = []

  for (const bucket of BUCKET_ORDER) {
    const bucketPositions = groups[bucket]
    if (!bucketPositions || bucketPositions.length === 0) continue

    const pnls = bucketPositions.map((p) => p.pnl_pct ?? 0)
    const wins = pnls.filter((p) => p > 0).length

    stats.push({
      bucket,
      count: bucketPositions.length,
      winRate: wins / bucketPositions.length,
      avgReturnPct: pnls.reduce((s, p) => s + p, 0) / pnls.length,
      bestTrade: Math.max(...pnls),
      worstTrade: Math.min(...pnls),
    })
  }

  return stats
}
