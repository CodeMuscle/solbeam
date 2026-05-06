'use client'

import type { FeedFilters } from '@/lib/feed-utils'
import type { TokenSource, OutcomeTier } from '@/lib/types'

interface Props {
  filters: FeedFilters
  onChange: (filters: FeedFilters) => void
  tokenCount: number
}

const sources: Array<{ value: TokenSource | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pump_fun', label: 'Pump.fun' },
  { value: 'raydium', label: 'Raydium' },
  { value: 'trending', label: 'Trending' },
]

const tiers: Array<{ value: OutcomeTier | 'all'; label: string }> = [
  { value: 'all', label: 'All Tiers' },
  { value: 'MOONSHOT', label: '🚀 Moonshot' },
  { value: 'RUNNER', label: '🏃 Runner' },
  { value: 'MODERATE_PUMP', label: '📈 Moderate' },
  { value: 'FLAT', label: '😐 Flat' },
  { value: 'DUMP', label: '📉 Dump' },
  { value: 'RUG', label: '💀 Rug' },
]

export function FeedFilter({ filters, onChange, tokenCount }: Props) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a] flex-wrap">
      <div className="flex items-center gap-1">
        {sources.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange({ ...filters, source: s.value })}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              filters.source === s.value
                ? 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-[#1e1e1e]" />

      <div className="flex items-center gap-2">
        <span className="text-[#555] text-xs">Min score</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
          className="w-24 accent-green-500"
        />
        <span className="text-[#888] text-xs tabular-nums w-6">{filters.minScore}</span>
      </div>

      <div className="w-px h-5 bg-[#1e1e1e]" />

      <select
        value={filters.tier}
        onChange={(e) => onChange({ ...filters, tier: e.target.value as OutcomeTier | 'all' })}
        className="text-xs bg-[#111] border border-[#1e1e1e] text-[#888] rounded px-2 py-1.5 outline-none focus:border-[#333]"
      >
        {tiers.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <span className="ml-auto text-[#444] text-xs tabular-nums">
        {tokenCount} token{tokenCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
