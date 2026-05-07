import type { DexPair } from './dexscreener'
import type { ScoreBreakdown, SignalWeights } from './types'

/**
 * Live score (0-100) computed from DexScreener data only.
 * No on-chain enrichment required — runs every cron tick for all tokens.
 *
 * Composition:
 *   - Liquidity quality (0-25): liq depth + lock signal proxy
 *   - Volume quality (0-25): 24h volume tier + buy/sell pressure
 *   - Momentum (0-25): vol/mcap ratio, price change, txn activity
 *   - Maturity & social (0-25): pair age sweet-spot, social links, narrative
 */
export function scorePairInline(
  pair: DexPair,
  _weights: SignalWeights,
  narrativeKeywords: string[],
  socialEnabled: boolean
): ScoreBreakdown {
  const liquidity = pair.liquidity?.usd ?? 0
  const volume24h = pair.volume?.h24 ?? 0
  const mcap = pair.marketCap ?? 0
  const h24 = pair.priceChange?.h24 ?? 0
  const h1 = pair.priceChange?.h1 ?? 0
  const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : 0
  const ageHours = ageMs / 3_600_000
  const ageDays = ageHours / 24
  const buys = pair.txns?.h1?.buys ?? 0
  const sells = pair.txns?.h1?.sells ?? 0
  const buySellRatio = sells > 0 ? buys / sells : buys > 0 ? 5 : 1
  const socialLinks = pair.info?.socials?.length ?? 0

  // Liquidity quality (0-25)
  let liqPts = 0
  if (liquidity >= 500_000) liqPts = 25
  else if (liquidity >= 100_000) liqPts = 18
  else if (liquidity >= 50_000) liqPts = 12
  else if (liquidity >= 20_000) liqPts = 7
  else if (liquidity >= 5_000) liqPts = 3

  // Volume quality (0-25)
  let volPts = 0
  if (volume24h >= 1_000_000) volPts = 15
  else if (volume24h >= 250_000) volPts = 11
  else if (volume24h >= 50_000) volPts = 7
  else if (volume24h >= 10_000) volPts = 3
  // Buy/sell pressure on top
  let volPressurePts = 0
  if (buySellRatio >= 3) volPressurePts = 10
  else if (buySellRatio >= 2) volPressurePts = 6
  else if (buySellRatio >= 1.2) volPressurePts = 3
  volPts = Math.min(25, volPts + volPressurePts)

  // Momentum (0-25)
  const volMcap = mcap > 0 ? volume24h / mcap : 0
  let momPts = 0
  if (volMcap >= 0.5) momPts += 10
  else if (volMcap >= 0.2) momPts += 6
  else if (volMcap >= 0.05) momPts += 3
  if (h24 > 50) momPts += 8
  else if (h24 > 10) momPts += 5
  else if (h24 > 0) momPts += 2
  if (h1 > 5) momPts += 5
  else if (h1 > 0) momPts += 2
  // Heavy 24h dump = momentum penalty
  if (h24 < -30) momPts -= 8
  momPts = Math.max(0, Math.min(25, momPts))

  // Maturity & social (0-25)
  let maturePts = 0
  // Sweet-spot: pair age 1h-30d (not too snipy, not stale)
  if (ageHours >= 1 && ageDays <= 30) maturePts += 8
  else if (ageDays > 30 && ageDays <= 180) maturePts += 12
  else if (ageDays > 180) maturePts += 8
  else if (ageHours >= 0.25) maturePts += 3
  // Social links
  if (socialLinks >= 2) maturePts += 6
  else if (socialLinks === 1) maturePts += 3
  // Narrative keyword match
  if (socialEnabled && narrativeKeywords.length > 0) {
    const haystack = `${pair.baseToken.name ?? ''} ${pair.baseToken.symbol ?? ''}`.toLowerCase()
    const hit = narrativeKeywords.some((k) => haystack.includes(k.toLowerCase()))
    if (hit) maturePts += 7
  }
  maturePts = Math.min(25, maturePts)

  const composite = liqPts + volPts + momPts + maturePts

  return {
    smartMoney: { walletCount: 0, recency: 0, winRate: 0, clusterPenalty: 0, total: 0 },
    tokenHealth: {
      lpLocked: liqPts,
      mintRenounced: 0,
      freezeDisabled: 0,
      devWalletPct: 0,
      bundlePenalty: 0,
      sniperPenalty: 0,
      insiderPenalty: 0,
      total: liqPts,
    },
    momentum: {
      volumeMcapRatio: Math.round(volMcap * 100) / 100,
      holderGrowthRate: 0,
      buySellRatio: Math.round(buySellRatio * 10) / 10,
      socialLinks,
      migration: pair.dexId === 'raydium' && ageHours < 1 ? 1 : 0,
      washTradePenalty: 0,
      botActivityPenalty: 0,
      total: Math.round(volPts + momPts),
    },
    deployer: { previousOutcomes: 0, walletAge: 0, solBalance: 0, total: 0 },
    socialBonus: socialLinks > 0 || socialEnabled ? Math.round(maturePts / 5) : 0,
    composite,
  }
}
