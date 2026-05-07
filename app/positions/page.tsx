import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentPrices } from '@/lib/prices'
import { calcPnlPct } from '@/lib/exit-monitor'
import { PositionTracker } from '@/components/positions/PositionTracker'
import type { Position } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface EnrichedPosition extends Position {
  current_price_usd: number | null
}

export default async function PositionsPage() {
  const { data: rows } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('status', 'open')
    .order('entry_timestamp', { ascending: false })

  const positions: Position[] = rows ?? []

  const mints = [...new Set(positions.map((p) => p.token_mint).filter(Boolean))]
  const priceMap = await getCurrentPrices(mints)

  const enriched: EnrichedPosition[] = positions.map((position) => {
    const currentPrice = priceMap.get(position.token_mint) ?? null
    const pnlPct = currentPrice
      ? calcPnlPct(position.entry_price_usd, currentPrice)
      : position.pnl_pct
    return { ...position, current_price_usd: currentPrice, pnl_pct: pnlPct }
  })

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-white font-semibold text-lg">Positions</h1>
          <p className="text-[#444] text-xs mt-0.5">
            Track paper and real trades · Exit monitor runs every minute
          </p>
        </div>
      </div>

      <PositionTracker initialPositions={enriched} />
    </div>
  )
}
