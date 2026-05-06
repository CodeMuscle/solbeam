import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Settings } from '@/lib/types'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: Partial<Omit<Settings, 'id'>>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.signal_weights) {
    const { smart_money, token_health, momentum, deployer } = body.signal_weights
    const total = smart_money + token_health + momentum + deployer
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Signal weights must sum to 100 (current sum: ${total})` },
        { status: 400 }
      )
    }
  }

  delete (body as Record<string, unknown>).id

  const { data, error } = await supabaseAdmin
    .from('settings')
    .update(body)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
