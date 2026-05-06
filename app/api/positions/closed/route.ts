import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('id, entry_score, pnl_pct, outcome_tier, entry_timestamp, exit_timestamp, mode')
    .eq('status', 'closed')
    .eq('mode', 'paper')
    .order('exit_timestamp', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
