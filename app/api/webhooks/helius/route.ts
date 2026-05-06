import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseWebhookTransaction } from '@/lib/helius'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { HeliusWebhookPayload } from '@/lib/helius'

function verifyHmac(payload: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.HELIUS_WEBHOOK_SECRET!
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()
  const signature = req.headers.get('authorization')

  if (!verifyHmac(rawBody, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: HeliusWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const records = []
  for (const tx of payload) {
    const parsed = parseWebhookTransaction(tx)
    if (!parsed) continue
    records.push({
      wallet_address: parsed.walletAddress,
      signature: parsed.signature,
      type: parsed.type,
      token_mint: parsed.tokenMint,
      token_symbol: parsed.tokenSymbol,
      amount_usd: null,
      dex: parsed.source,
      timestamp: parsed.timestamp.toISOString(),
    })
  }

  if (records.length > 0) {
    const { error } = await supabaseAdmin
      .from('wallet_transactions')
      .upsert(records, { onConflict: 'signature', ignoreDuplicates: true })

    if (error) {
      console.error('Failed to insert wallet_transactions:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  return NextResponse.json({ processed: records.length })
}
