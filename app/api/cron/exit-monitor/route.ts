import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentPrices } from '@/lib/prices'
import { checkExitConditions, calcPnlPct } from '@/lib/exit-monitor'
import {
  sendTelegramMessage,
  formatExitAlert,
  formatBreakEvenAlert,
  formatStopLossAlert,
} from '@/lib/telegram'
import { isAlertsMuted } from '@/lib/telegram-commands'
import type { OutcomeTier } from '@/lib/types'

function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET ?? ''}`
}

const TIER_TO_OUTCOME: Record<string, OutcomeTier> = {
  MOONSHOT: 'MOONSHOT',
  RUNNER: 'RUNNER',
  MODERATE_PUMP: 'MODERATE_PUMP',
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('take_profit_tiers, stop_loss_pct, break_even_fee_pct')
    .eq('id', 1)
    .single()

  const takeProfitTiers: number[] = settings?.take_profit_tiers ?? [1.5, 3.0, 10.0]
  const stopLossPct: number = settings?.stop_loss_pct ?? 30
  const breakEvenFeePct: number = settings?.break_even_fee_pct ?? 0.5

  const { data: positions, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('status', 'open')

  if (error || !positions) {
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }

  if (positions.length === 0) {
    return NextResponse.json({ checked: 0, alerts: 0 })
  }

  const mints = [...new Set(positions.map((p) => p.token_mint).filter(Boolean))]
  const priceMap = await getCurrentPrices(mints)
  const alertsMuted = await isAlertsMuted()

  let alertsFired = 0
  let alertsSuppressed = 0

  for (const position of positions) {
    const currentPrice = priceMap.get(position.token_mint)
    if (!currentPrice) continue

    const alreadyAlerted = new Set<string>(
      position.notes ? JSON.parse(position.notes) : []
    )

    const exitCondition = checkExitConditions({
      entryPriceUsd: position.entry_price_usd,
      currentPriceUsd: currentPrice,
      takeProfitTiers,
      stopLossPct,
      stopLossEnabled: stopLossPct > 0,
      breakEvenFeePct,
      alreadyAlertedTiers: alreadyAlerted,
    })

    if (!exitCondition) continue

    let message: string
    if (exitCondition.type === 'BREAK_EVEN') {
      message = formatBreakEvenAlert({
        symbol: position.token_symbol ?? position.token_mint.slice(0, 8),
        currentPrice,
      })
    } else if (exitCondition.type === 'STOP_LOSS') {
      message = formatStopLossAlert(
        position.token_symbol ?? position.token_mint.slice(0, 8),
        Math.abs(exitCondition.pnlPct)
      )
    } else {
      message = formatExitAlert({
        symbol: position.token_symbol ?? position.token_mint.slice(0, 8),
        tier: TIER_TO_OUTCOME[exitCondition.type] ?? 'MODERATE_PUMP',
        multiplier: exitCondition.multiplier,
        entryPrice: position.entry_price_usd,
        currentPrice,
      })
    }

    if (alertsMuted) {
      alertsSuppressed++
    } else {
      await sendTelegramMessage(message)
      alertsFired++
    }

    const updatedAlerted = [...alreadyAlerted, exitCondition.type]
    const pnlPct = calcPnlPct(position.entry_price_usd, currentPrice)

    await supabaseAdmin
      .from('positions')
      .update({
        pnl_pct: pnlPct,
        notes: JSON.stringify(updatedAlerted),
      })
      .eq('id', position.id)
  }

  return NextResponse.json({
    checked: positions.length,
    alerts: alertsFired,
    suppressed: alertsSuppressed,
  })
}
