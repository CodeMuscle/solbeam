'use client'

import { useState } from 'react'
import { PnLBadge } from './PnLBadge'
import { TierBadge } from '@/components/feed/TierBadge'
import { ScorePill } from '@/components/feed/ScorePill'
import type { Position } from '@/lib/types'

interface EnrichedPosition extends Position {
  current_price_usd: number | null
}

interface Props {
  position: EnrichedPosition
  onClose: (id: string, exitPrice: number) => Promise<void>
}

export function PositionCard({ position, onClose }: Props) {
  const [closing, setClosing] = useState(false)

  const multiplier = position.current_price_usd
    ? position.current_price_usd / position.entry_price_usd
    : null

  const isNearBreakEven =
    position.current_price_usd !== null &&
    position.current_price_usd <= position.entry_price_usd * 1.01 &&
    position.current_price_usd >= position.entry_price_usd * 0.95

  async function handleClose() {
    if (!position.current_price_usd) return
    setClosing(true)
    await onClose(position.id, position.current_price_usd)
    setClosing(false)
  }

  return (
    <div
      className={`bg-[#0e0e0e] border rounded-lg p-4 transition-colors ${
        isNearBreakEven
          ? 'border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
          : 'border-[#1e1e1e]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">{position.token_symbol ?? 'Unknown'}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
              position.mode === 'paper'
                ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                : 'text-green-400 border-green-500/30 bg-green-500/10'
            }`}
          >
            {position.mode === 'paper' ? 'PAPER' : 'REAL'}
          </span>
          {position.entry_score && <ScorePill score={position.entry_score} size="sm" />}
        </div>
        {position.outcome_tier && <TierBadge tier={position.outcome_tier} />}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-3 text-center">
        <div>
          <div className="text-[#444] text-xs mb-1">Entry</div>
          <div className="text-[#888] text-sm font-mono">
            ${position.entry_price_usd.toPrecision(4)}
          </div>
        </div>
        <div>
          <div className="text-[#444] text-xs mb-1">Current</div>
          <div className="text-[#ccc] text-sm font-mono">
            {position.current_price_usd
              ? `$${position.current_price_usd.toPrecision(4)}`
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-[#444] text-xs mb-1">P&L</div>
          <PnLBadge pnlPct={position.pnl_pct} />
        </div>
      </div>

      {multiplier !== null && (
        <div className="text-center mb-3">
          <span className={`text-lg font-bold tabular-nums ${
            multiplier >= 1 ? 'text-green-400' : 'text-red-400'
          }`}>
            {multiplier.toFixed(2)}x
          </span>
        </div>
      )}

      {isNearBreakEven && (
        <div className="text-amber-400 text-xs text-center mb-3 animate-pulse">
          ⚠️ Near break-even — consider exiting
        </div>
      )}

      <button
        onClick={handleClose}
        disabled={closing || !position.current_price_usd}
        className="w-full text-xs py-2 rounded border border-[#2a2a2a] text-[#666] hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {closing ? 'Closing…' : `Close at $${position.current_price_usd?.toPrecision(4) ?? '—'}`}
      </button>
    </div>
  )
}
