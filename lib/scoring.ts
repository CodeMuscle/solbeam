import type { DexPair } from './dexscreener'
import { computeCompositeScore } from './signal-engine'
import type { ScoreBreakdown, SignalWeights } from './types'

export function scorePairInline(
  pair: DexPair,
  weights: SignalWeights,
  narrativeKeywords: string[],
  socialEnabled: boolean
): ScoreBreakdown {
  const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : 0
  const ageMinutes = ageMs / 60_000
  const volumeMcapRatio = pair.volume?.h24 && pair.marketCap
    ? pair.volume.h24 / pair.marketCap
    : 0
  const buySellRatio = pair.txns?.h1
    ? pair.txns.h1.buys / Math.max(pair.txns.h1.sells, 1)
    : 1
  const socialLinksLive = pair.info?.socials?.length ?? 0

  return computeCompositeScore({
    smartMoney: {
      walletCount: 0,
      minutesSinceFirstEntry: 60,
      avgWalletWinRate: 0.5,
      isClustered: false,
      weights,
    },
    tokenHealth: {
      lpBurned: false,
      lpLockMonths: 0,
      mintRenounced: false,
      freezeDisabled: false,
      devWalletPct: 5,
      bundledLaunch: false,
      sniperCount: 0,
      insiderWalletsDetected: false,
      weights,
    },
    momentum: {
      volumeMcapRatio,
      newHoldersPerMin: 0,
      buySellRatio,
      socialLinksLive,
      isPumpFunToRaydiumMigration: pair.dexId === 'raydium' && ageMinutes < 60,
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
      tokenNameAndDescription: `${pair.baseToken.name ?? ''} ${pair.baseToken.symbol ?? ''}`,
      telegramMemberCount: 0,
      telegramMemberGrowthPerHour: 0,
      isCoinGeckoTrending: false,
      enabled: socialEnabled,
    },
  })
}
