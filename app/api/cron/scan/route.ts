import { NextRequest, NextResponse } from 'next/server'
import { fetchNewSolanaPairs, fetchTrendingTokens } from '@/lib/dexscreener'
import { normalizeDexPairToToken, cacheToken } from '@/lib/ingest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TokenSource } from '@/lib/types'

function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET ?? ''}`
}

async function upsertTokens(
  pairs: Awaited<ReturnType<typeof fetchNewSolanaPairs>>,
  source: TokenSource
) {
  if (pairs.length === 0) return 0

  const tokens = pairs.map((pair) => normalizeDexPairToToken(pair, source))

  const { error } = await supabaseAdmin
    .from('tokens')
    .upsert(tokens, { onConflict: 'mint', ignoreDuplicates: false })

  if (error) {
    console.error(`Failed to upsert ${source} tokens:`, error)
    return 0
  }

  await Promise.all(tokens.map((t) => cacheToken(t)))
  return tokens.length
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [newPairs, trendingPairs] = await Promise.all([
    fetchNewSolanaPairs(),
    fetchTrendingTokens(),
  ])

  const [newCount, trendingCount] = await Promise.all([
    upsertTokens(newPairs, 'raydium'),
    upsertTokens(trendingPairs, 'trending'),
  ])

  return NextResponse.json({
    new: newCount,
    trending: trendingCount,
    total: newCount + trendingCount,
  })
}
