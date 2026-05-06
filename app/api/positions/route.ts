import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchPrice } from '@/lib/jupiter'
import { calcPnlPct } from '@/lib/exit-monitor'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('status', 'open')
    .order('entry_timestamp', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const mints = [...new Set(data.map((p) => p.token_mint).filter(Boolean))]
  const prices = mints.length > 0
    ? await Promise.all(mints.map((m) => fetchPrice(m).then((price) => [m, price] as const)))
    : []
  const priceMap = new Map(prices.filter(([, price]) => price !== null) as [string, number][])

  const enriched = data.map((position) => {
    const currentPrice = priceMap.get(position.token_mint) ?? null
    const pnlPct = currentPrice
      ? calcPnlPct(position.entry_price_usd, currentPrice)
      : null
    return { ...position, current_price_usd: currentPrice, pnl_pct: pnlPct }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    token_mint: string
    token_symbol: string
    entry_price_usd: number
    entry_score?: number
    mode?: 'paper' | 'real'
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.token_mint || !body.entry_price_usd) {
    return NextResponse.json(
      { error: 'token_mint and entry_price_usd are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('positions')
    .insert({
      token_mint: body.token_mint,
      token_symbol: body.token_symbol,
      entry_price_usd: body.entry_price_usd,
      entry_score: body.entry_score ?? null,
      mode: body.mode ?? 'paper',
      notes: body.notes ?? null,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
