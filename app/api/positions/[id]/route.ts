import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcPnlPct, calcMultiplier } from '@/lib/exit-monitor'
import { classifyTier } from '@/lib/tier-classifier'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params

  let body: { exit_price_usd: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: position, error: fetchError } = await supabaseAdmin
    .from('positions')
    .select('entry_price_usd')
    .eq('id', id)
    .single()

  if (fetchError || !position) {
    return NextResponse.json({ error: 'Position not found' }, { status: 404 })
  }

  const pnlPct = calcPnlPct(position.entry_price_usd, body.exit_price_usd)
  const multiplier = calcMultiplier(position.entry_price_usd, body.exit_price_usd)
  const outcomeTier = classifyTier(multiplier)

  const { data, error } = await supabaseAdmin
    .from('positions')
    .update({
      exit_price_usd: body.exit_price_usd,
      exit_timestamp: new Date().toISOString(),
      pnl_pct: pnlPct,
      outcome_tier: outcomeTier,
      status: 'closed',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
