'use client'

import { useEffect, useState } from 'react'
import { ForwardTestReport } from '@/components/backtester/ForwardTestReport'
import { HistoricalReplayTab } from '@/components/backtester/HistoricalReplayTab'
import { computeForwardTestStats } from '@/lib/backtester-stats'
import type { ClosedPosition, ScoreBucketStats } from '@/lib/backtester-stats'

export default function BacktesterPage() {
  const [tab, setTab] = useState<'forward' | 'historical'>('forward')
  const [positions, setPositions] = useState<ClosedPosition[]>([])
  const [stats, setStats] = useState<ScoreBucketStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/positions/closed')
      if (res.ok) {
        const data: ClosedPosition[] = await res.json()
        setPositions(data)
        setStats(computeForwardTestStats(data))
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-white font-semibold text-lg">Backtester</h1>
        <p className="text-[#444] text-xs mt-0.5">
          Calibrate your signal thresholds against real paper trade outcomes
        </p>
      </div>

      <div className="flex gap-1 mb-6">
        {(['forward', 'historical'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-4 py-2 rounded transition-colors capitalize ${
              tab === t
                ? 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {t === 'forward' ? 'Forward Test' : 'Historical Replay'}
          </button>
        ))}
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        {loading ? (
          <div className="text-center py-8 text-[#333] text-sm">Loading…</div>
        ) : tab === 'forward' ? (
          <ForwardTestReport stats={stats} totalTrades={positions.length} />
        ) : (
          <HistoricalReplayTab />
        )}
      </div>
    </div>
  )
}
