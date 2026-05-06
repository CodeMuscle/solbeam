import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteWebhook } from '@/lib/helius'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params

  const { data: wallet } = await supabaseAdmin
    .from('tracked_wallets')
    .select('helius_webhook_id')
    .eq('id', id)
    .single()

  if (wallet?.helius_webhook_id) {
    await deleteWebhook(wallet.helius_webhook_id)
  }

  const { error } = await supabaseAdmin
    .from('tracked_wallets')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
