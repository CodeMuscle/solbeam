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

export function LiveFeed({ initialTokens }: Props) {
  const tokens = useRealtimeTokens(initialTokens)
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)

  const { qualified, disqualified } = filterTokens(tokens, filters)

  return (
    <div className={`flex h-full ${selectedToken ? 'pr-80' : ''}`}>
      <div className="flex-1 flex flex-col min-w-0">
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
