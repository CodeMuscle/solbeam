import { NextRequest, NextResponse } from 'next/server'
import { fetchNewSolanaPairs, fetchTrendingTokens, type DexPair } from '@/lib/dexscreener'
import { normalizeDexPairToToken, cacheToken } from '@/lib/ingest'
import { scorePairInline } from '@/lib/scoring'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TokenSource, SignalWeights } from '@/lib/types'

function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET ?? ''}`
}

interface ScoringContext {
  weights: SignalWeights
  narrativeKeywords: string[]
  socialEnabled: boolean
}

const DEFAULT_WEIGHTS: SignalWeights = {
  smart_money: 30,
  token_health: 25,
  momentum: 25,
  deployer: 20,
}

async function loadScoringContext(): Promise<ScoringContext> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('signal_weights, narrative_keywords, social_signal_enabled')
    .eq('id', 1)
    .single()

  return {
    weights: data?.signal_weights ?? DEFAULT_WEIGHTS,
    narrativeKeywords: data?.narrative_keywords ?? [],
    socialEnabled: data?.social_signal_enabled ?? true,
  }
}

async function upsertTokens(
  pairs: DexPair[],
  sourceFallback: TokenSource,
  ctx: ScoringContext
) {
  if (pairs.length === 0) return 0

  const tokens = pairs.map((pair) => {
    const base = normalizeDexPairToToken(pair, sourceFallback)
    if (base.disqualified) return base
    const breakdown = scorePairInline(
      pair,
      ctx.weights,
      ctx.narrativeKeywords,
      ctx.socialEnabled
    )
    return {
      ...base,
      score: breakdown.composite,
      score_breakdown: breakdown,
    }
  })

  const { error } = await supabaseAdmin
    .from('tokens')
    .upsert(tokens, { onConflict: 'mint', ignoreDuplicates: false })

  if (error) {
    console.error(`[scan] Failed to upsert ${sourceFallback} tokens:`, error)
    return 0
  }

  await Promise.all(tokens.map((t) => cacheToken(t)))
  return tokens.length
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [newPairs, trendingPairs, ctx] = await Promise.all([
      fetchNewSolanaPairs(),
      fetchTrendingTokens(),
      loadScoringContext(),
    ])

    console.log(
      `[scan] Fetched ${newPairs.length} new + ${trendingPairs.length} trending pairs`
    )

    const [newCount, trendingCount] = await Promise.all([
      upsertTokens(newPairs, 'raydium', ctx),
      upsertTokens(trendingPairs, 'trending', ctx),
    ])

    return NextResponse.json({
      new: newCount,
      trending: trendingCount,
      total: newCount + trendingCount,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[scan] Failed:', msg, error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
