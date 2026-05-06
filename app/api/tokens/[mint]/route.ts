import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchTokenPair } from '@/lib/dexscreener'
import { fetchPrice } from '@/lib/jupiter'
import { getTokenMetadata } from '@/lib/helius'
import { checkDisqualifiers } from '@/lib/disqualifiers'
import { computeCompositeScore } from '@/lib/signal-engine'
import { classifyTier } from '@/lib/tier-classifier'
import { getCachedToken, cacheToken } from '@/lib/ingest'
import type { SignalEngineInput } from '@/lib/signal-engine'

interface RouteParams {
  params: Promise<{ mint: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { mint } = await params

  const cached = await getCachedToken(mint)
  if (cached?.score && cached.score > 0) {
    return NextResponse.json(cached)
  }

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  const weights = settings?.signal_weights ?? {
    smart_money: 30,
    token_health: 25,
    momentum: 25,
    deployer: 20,
  }
  const narrativeKeywords: string[] = settings?.narrative_keywords ?? []
  const socialEnabled: boolean = settings?.social_signal_enabled ?? true

  const [pair, livePrice, metadata] = await Promise.all([
    fetchTokenPair(mint),
    fetchPrice(mint),
    getTokenMetadata(mint),
  ])

  if (!pair) {
    return NextResponse.json({ error: 'Token not found on DexScreener' }, { status: 404 })
  }

  const { count: smartMoneyCount } = await supabaseAdmin
    .from('wallet_transactions')
    .select('wallet_address', { count: 'exact', head: true })
    .eq('token_mint', mint)
    .eq('type', 'buy')

  const tokenAgeMinutes = pair.pairCreatedAt
    ? (Date.now() - pair.pairCreatedAt) / 60_000
    : 999

  const dqResult = checkDisqualifiers({
    top10HolderPct: metadata?.tokenInfo?.concentrationRisk ?? 0,
    sniperWalletPct: 0,
    devSoldPct: 0,
    deployerRugCount: 0,
    bundledLaunch: false,
    mintRenounced: metadata?.onChainInfo?.mintAuthority === null,
    tokenAgeMinutes,
  })

  const engineInput: SignalEngineInput = {
    smartMoney: {
      walletCount: smartMoneyCount ?? 0,
      minutesSinceFirstEntry: 60,
      avgWalletWinRate: 0.5,
      isClustered: false,
      weights,
    },
    tokenHealth: {
      lpBurned: false,
      lpLockMonths: 0,
      mintRenounced: metadata?.onChainInfo?.mintAuthority === null,
      freezeDisabled: metadata?.onChainInfo?.freezeAuthority === null,
      devWalletPct: 5,
      bundledLaunch: false,
      sniperCount: 0,
      insiderWalletsDetected: false,
      weights,
    },
    momentum: {
      volumeMcapRatio: pair.volume.h24 && pair.marketCap
        ? pair.volume.h24 / pair.marketCap
        : 0,
      newHoldersPerMin: 0,
      buySellRatio: pair.txns?.h1
        ? pair.txns.h1.buys / Math.max(pair.txns.h1.sells, 1)
        : 1,
      socialLinksLive: (pair.info?.socials?.length ?? 0) > 0 ? 1 : 0,
      isPumpFunToRaydiumMigration: pair.dexId === 'raydium' && tokenAgeMinutes < 60,
      washTradeDetected: false,
      volumeSpikeNoNewWallets: false,
      weights,
    },
    deployer: {
      previousRunnerPct: 0,
      previousTokenCount: 0,
      walletAgeDays: 0,
      deployerSolBalance: 0,
      weights,
    },
    social: {
      narrativeKeywords,
      tokenNameAndDescription: `${pair.baseToken.name} ${pair.baseToken.symbol}`,
      telegramMemberCount: 0,
      telegramMemberGrowthPerHour: 0,
      isCoinGeckoTrending: false,
      enabled: socialEnabled,
    },
  }

  const scoreBreakdown = computeCompositeScore(engineInput)

  const tokenRecord = {
    mint,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    source: 'raydium' as const,
    score: dqResult ? 0 : scoreBreakdown.composite,
    disqualified: !!dqResult,
    disqualify_reason: dqResult ?? null,
    tier: classifyTier(1),
    price_usd: livePrice ?? parseFloat(pair.priceUsd),
    market_cap_usd: pair.marketCap,
    volume_24h_usd: pair.volume.h24,
    liquidity_usd: pair.liquidity.usd,
    holder_count: null,
    lp_locked: false,
    mint_renounced: metadata?.onChainInfo?.mintAuthority === null,
    freeze_disabled: metadata?.onChainInfo?.freezeAuthority === null,
    dev_wallet_pct: null,
    smart_money_count: smartMoneyCount ?? 0,
    deployer_address: null,
    score_breakdown: scoreBreakdown,
  }

  await supabaseAdmin
    .from('tokens')
    .upsert(tokenRecord, { onConflict: 'mint' })

  await supabaseAdmin.from('score_history').insert({
    token_mint: mint,
    score: tokenRecord.score,
    score_breakdown: scoreBreakdown,
    weights_snapshot: weights,
    actual_outcome: null,
    peak_multiplier: null,
  })

  await cacheToken(tokenRecord)

  return NextResponse.json(tokenRecord)
}
