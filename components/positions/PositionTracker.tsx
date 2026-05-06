'use client'

import { useState, useCallback } from 'react'
import { PositionCard } from './PositionCard'
import type { Position } from '@/lib/types'

interface EnrichedPosition extends Position {
  current_price_usd: number | null
}

interface Props {
  initialPositions: EnrichedPosition[]
}

export function PositionTracker({ initialPositions }: Props) {
  const [positions, setPositions] = useState<EnrichedPosition[]>(initialPositions)
  const [modeFilter, setModeFilter] = useState<'paper' | 'real' | 'all'>('all')

  const handleClose = useCallback(async (id: string, exitPrice: number) => {
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exit_price_usd: exitPrice }),
    })
    if (res.ok) {
      setPositions((prev) => prev.filter((p) => p.id !== id))
    }
  }, [])

  const filtered = positions.filter(
    (p) => modeFilter === 'all' || p.mode === modeFilter
  )

  return (
    <div>
      <div className="flex items-center gap-1 px-6 py-3 border-b border-[#1a1a1a]">
        {(['all', 'paper', 'real'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setModeFilter(mode)}
            className={`text-xs px-3 py-1.5 rounded capitalize transition-colors ${
              modeFilter === mode
                ? 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {mode}
          </button>
        ))}
        <span className="ml-auto text-[#333] text-xs">
          {filtered.length} open position{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#333] text-sm">No open positions</p>
            <p className="text-[#222] text-xs mt-2">
              Use the &ldquo;Paper Buy&rdquo; button on the Live Feed to open a paper trade.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onClose={handleClose}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
