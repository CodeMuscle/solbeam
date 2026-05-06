'use client'

import { useState } from 'react'
import type { Token } from '@/lib/types'

interface Props {
  tokens: Token[]
}

export function DisqualifiedSection({ tokens }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (tokens.length === 0) return null

  return (
    <div className="border-t border-[#1a1a1a] mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-[#444] hover:text-[#666] transition-colors"
      >
        <span>⛔ {tokens.length} disqualified token{tokens.length !== 1 ? 's' : ''}</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-[#111]">
          {tokens.map((token) => (
            <div key={token.mint} className="flex items-center gap-3 px-4 py-2 opacity-40">
              <span className="text-[#666] text-xs font-semibold w-16 truncate">
                {token.symbol ?? token.mint.slice(0, 6)}
              </span>
              <span className="text-[#444] text-xs">{token.disqualify_reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
