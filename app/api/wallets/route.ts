import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { registerWebhook } from '@/lib/helius'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('tracked_wallets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { address: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.address || body.address.length < 32) {
    return NextResponse.json(
      { error: 'Valid Solana wallet address required' },
      { status: 400 }
    )
  }

  const webhookId = await registerWebhook([body.address])

  const { data, error } = await supabaseAdmin
    .from('tracked_wallets')
    .insert({
      address: body.address,
      label: body.label ?? null,
      helius_webhook_id: webhookId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
