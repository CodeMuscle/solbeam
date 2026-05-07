import type { Token, TokenSource, OutcomeTier } from './types'

export type FeedTab = 'all' | 'established' | 'gems'

export interface FeedFilters {
  tab: FeedTab
  source: TokenSource | 'all'
  minScore: number
  tier: OutcomeTier | 'all'
}

export function scoreToColor(score: number): string {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}

export function scoreToTextColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

export function tierToColor(tier: OutcomeTier | null): string {
  switch (tier) {
    case 'MOONSHOT': return 'bg-green-500/20 text-green-300 border-green-500/30'
    case 'RUNNER': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'MODERATE_PUMP': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'FLAT': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    case 'DUMP': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'RUG': return 'bg-red-500/20 text-red-400 border-red-500/30'
    default: return 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30'
  }
}

export function tierToLabel(tier: OutcomeTier | null): string {
  switch (tier) {
    case 'MOONSHOT': return '🚀 MOONSHOT'
    case 'RUNNER': return '🏃 RUNNER'
    case 'MODERATE_PUMP': return '📈 MODERATE'
    case 'FLAT': return '😐 FLAT'
    case 'DUMP': return '📉 DUMP'
    case 'RUG': return '💀 RUG'
    default: return '— UNSCORED'
  }
}

export function formatMarketCap(value: number | null): string {
  if (!value) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function formatAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  return `${Math.floor(diffHr / 24)}d`
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function pairAgeDays(token: Token): number | null {
  if (!token.pair_created_at) return null
  return (Date.now() - new Date(token.pair_created_at).getTime()) / ONE_DAY_MS
}

function matchesTab(token: Token, tab: FeedTab): boolean {
  if (tab === 'all') return true

  const ageDays = pairAgeDays(token)
  const liq = token.liquidity_usd ?? 0
  const vol24 = token.volume_24h_usd ?? 0

  if (tab === 'established') {
    return ageDays !== null && ageDays >= 30 && liq >= 50_000 && vol24 >= 10_000
  }

  if (tab === 'gems') {
    return (
      ageDays !== null &&
      ageDays >= 1 &&
      ageDays <= 60 &&
      token.score >= 50 &&
      liq >= 20_000
    )
  }

  return true
}

export function filterTokens(
  tokens: Token[],
  filters: FeedFilters
): { qualified: Token[]; disqualified: Token[] } {
  const disqualified = tokens.filter((t) => t.disqualified)
  const active = tokens.filter((t) => !t.disqualified)

  const qualified = active.filter((t) => {
    if (!matchesTab(t, filters.tab)) return false
    if (filters.source !== 'all' && t.source !== filters.source) return false
    if (t.score < filters.minScore) return false
    if (filters.tier !== 'all' && t.tier !== filters.tier) return false
    return true
  })

  return { qualified, disqualified }
}
