'use client'

import { useState } from 'react'
import { useRealtimeTokens } from '@/hooks/useRealtimeTokens'
import { FeedFilter } from './FeedFilter'
import { TokenRow } from './TokenRow'
import { TokenDetailPanel } from './TokenDetailPanel'
import { DisqualifiedSection } from './DisqualifiedSection'
import { filterTokens } from '@/lib/feed-utils'
import type { Token } from '@/lib/types'
import type { FeedFilters } from '@/lib/feed-utils'

interface Props {
  initialTokens: Token[]
}

const DEFAULT_FILTERS: FeedFilters = { tab: 'all', source: 'all', minScore: 0, tier: 'all' }

function formatLastUpdated(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

export function LiveFeed({ initialTokens }: Props) {
  const { tokens, lastUpdated, refetch } = useRealtimeTokens(initialTokens)
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const { qualified, disqualified } = filterTokens(tokens, filters)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className={`flex h-full ${selectedToken ? 'pr-80' : ''}`}>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a] text-xs">
          <span className="text-[#444]">
            Last updated: <span className="text-[#888] tabular-nums">{formatLastUpdated(lastUpdated)}</span>
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#1e1e1e] text-[#666] hover:text-[#ccc] hover:border-[#2a2a2a] transition-colors disabled:opacity-50"
          >
            <span className={refreshing ? 'inline-block animate-spin' : ''}>⟳</span>
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>

        <FeedFilter filters={filters} onChange={setFilters} tokenCount={qualified.length} />

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                {['Token', 'Source', 'Age', 'Market Cap', 'Score', 'Tier', '🐋', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[#444] text-xs font-medium uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {qualified.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#333] text-sm">
                    No tokens match your filters. Waiting for new tokens…
                  </td>
                </tr>
              ) : (
                qualified.map((token) => (
                  <TokenRow
                    key={token.mint}
                    token={token}
                    isSelected={selectedToken?.mint === token.mint}
                    onSelect={(t) =>
                      setSelectedToken((prev) => (prev?.mint === t.mint ? null : t))
                    }
                  />
                ))
              )}
            </tbody>
          </table>

          <DisqualifiedSection tokens={disqualified} />
        </div>
      </div>

      {selectedToken && (
        <TokenDetailPanel token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}
    </div>
  )
}
