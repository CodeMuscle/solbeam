import type { DexPair } from './dexscreener'
import type { ScoreBreakdown, SignalWeights } from './types'

/**
 * Live score (0-100) computed from DexScreener data only.
 * No on-chain enrichment required — runs every cron tick for all tokens.
 *
 * Weights are applied to four 0-25 sub-scores:
 *   - Liquidity quality (depth + survivability)
 *   - Volume & buy pressure (active demand)
 *   - Momentum (multi-timeframe price action)
 *   - Maturity & social (legitimacy proxy)
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
  const h6 = pair.priceChange?.h6 ?? 0
  const h1 = pair.priceChange?.h1 ?? 0
  const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : 0
  const ageHours = ageMs / 3_600_000
  const ageDays = ageHours / 24
  const buys = pair.txns?.h1?.buys ?? 0
  const sells = pair.txns?.h1?.sells ?? 0
  const buySellRatio = sells > 0 ? buys / sells : buys > 0 ? 5 : 1
  const socialLinks = pair.info?.socials?.length ?? 0
  const volMcap = mcap > 0 ? volume24h / mcap : 0

  // ── Liquidity quality (0-25) — stricter thresholds
  let liqPts = 0
  if (liquidity >= 1_000_000) liqPts = 25
  else if (liquidity >= 250_000) liqPts = 18
  else if (liquidity >= 100_000) liqPts = 12
  else if (liquidity >= 30_000) liqPts = 6
  else if (liquidity >= 10_000) liqPts = 2

  // ── Volume & buy pressure (0-25) — requires real volume
  let volPts = 0
  if (volume24h >= 5_000_000) volPts = 14
  else if (volume24h >= 1_000_000) volPts = 10
  else if (volume24h >= 250_000) volPts = 6
  else if (volume24h >= 50_000) volPts = 3
  let pressurePts = 0
  if (buySellRatio >= 4) pressurePts = 11
  else if (buySellRatio >= 2.5) pressurePts = 7
  else if (buySellRatio >= 1.5) pressurePts = 4
  else if (buySellRatio >= 1) pressurePts = 1
  // Penalty: very high volume with flat/declining price = wash trading suspected
  if (volMcap >= 0.5 && h24 < 5) pressurePts -= 5
  volPts = Math.max(0, Math.min(25, volPts + pressurePts))

  // ── Momentum (0-25) — multi-timeframe confirmation
  let momPts = 0
  if (volMcap >= 1.0) momPts += 8
  else if (volMcap >= 0.4) momPts += 5
  else if (volMcap >= 0.1) momPts += 2
  if (h24 >= 100) momPts += 6
  else if (h24 >= 30) momPts += 4
  else if (h24 >= 10) momPts += 2
  else if (h24 < -20) momPts -= 6
  // Sustained-momentum bonus: all three timeframes positive
  if (h24 > 0 && h6 > 0 && h1 > 0) momPts += 5
  // Reversal penalty: 24h up but 1h reversing
  if (h24 > 50 && h1 < -10) momPts -= 8
  momPts = Math.max(0, Math.min(25, momPts))

  // ── Maturity & social (0-25)
  let maturePts = 0
  // Sweet-spot age: 6h-30d (avoids snipe risk + stale tokens)
  if (ageHours >= 6 && ageDays <= 7) maturePts += 10
  else if (ageDays > 7 && ageDays <= 60) maturePts += 12
  else if (ageDays > 60 && ageDays <= 365) maturePts += 8
  else if (ageDays > 365) maturePts += 5
  else if (ageHours >= 1) maturePts += 3
  // Social signals
  if (socialLinks >= 2) maturePts += 6
  else if (socialLinks === 1) maturePts += 3
  // Narrative match
  if (socialEnabled && narrativeKeywords.length > 0) {
    const haystack = `${pair.baseToken.name ?? ''} ${pair.baseToken.symbol ?? ''}`.toLowerCase()
    const hit = narrativeKeywords.some((k) => haystack.includes(k.toLowerCase()))
    if (hit) maturePts += 5
  }
  maturePts = Math.min(25, maturePts)

  const composite = Math.max(0, Math.min(100, liqPts + volPts + momPts + maturePts))

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
      washTradePenalty: volMcap >= 0.5 && h24 < 5 ? -5 : 0,
      botActivityPenalty: 0,
      total: Math.round(volPts + momPts),
    },
    deployer: { previousOutcomes: 0, walletAge: 0, solBalance: 0, total: 0 },
    socialBonus: socialLinks > 0 || socialEnabled ? Math.round(maturePts / 5) : 0,
    composite,
  }
}
