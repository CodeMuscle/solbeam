import type { SignalWeights, ScoreBreakdown } from './types'

export interface SmartMoneyInput {
  walletCount: number
  minutesSinceFirstEntry: number
  avgWalletWinRate: number
  isClustered: boolean
  weights: SignalWeights
}

export interface TokenHealthInput {
  lpBurned: boolean
  lpLockMonths: number
  mintRenounced: boolean
  freezeDisabled: boolean
  devWalletPct: number
  bundledLaunch: boolean
  sniperCount: number
  insiderWalletsDetected: boolean
  weights: SignalWeights
}

export interface MomentumInput {
  volumeMcapRatio: number
  newHoldersPerMin: number
  buySellRatio: number
  socialLinksLive: number
  isPumpFunToRaydiumMigration: boolean
  washTradeDetected: boolean
  volumeSpikeNoNewWallets: boolean
  weights: SignalWeights
}

export interface DeployerInput {
  previousRunnerPct: number
  previousTokenCount: number
  walletAgeDays: number
  deployerSolBalance: number
  weights: SignalWeights
}

export interface SocialBonusInput {
  narrativeKeywords: string[]
  tokenNameAndDescription: string
  telegramMemberCount: number
  telegramMemberGrowthPerHour: number
  isCoinGeckoTrending: boolean
  enabled: boolean
}

export interface SignalEngineInput {
  smartMoney: SmartMoneyInput
  tokenHealth: TokenHealthInput
  momentum: MomentumInput
  deployer: DeployerInput
  social: SocialBonusInput
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function scaleToWeight(rawPts: number, maxRawPts: number, weight: number): number {
  return Math.round((rawPts / maxRawPts) * weight)
}

export function scoreSmartMoney(input: SmartMoneyInput): ScoreBreakdown['smartMoney'] {
  const walletCount =
    input.walletCount >= 3 ? 15 : input.walletCount === 2 ? 10 : input.walletCount === 1 ? 5 : 0

  const recency =
    input.minutesSinceFirstEntry < 2 ? 10
    : input.minutesSinceFirstEntry < 10 ? 6
    : input.minutesSinceFirstEntry < 30 ? 2
    : 0

  const winRate = input.avgWalletWinRate > 0.65 ? 5 : input.avgWalletWinRate > 0.5 ? 3 : 0

  const clusterPenalty = input.isClustered ? -10 : 0

  const raw = walletCount + recency + winRate + clusterPenalty
  const total = scaleToWeight(clamp(raw, 0, 30), 30, input.weights.smart_money)

  return { walletCount, recency, winRate, clusterPenalty, total }
}

export function scoreTokenHealth(input: TokenHealthInput): ScoreBreakdown['tokenHealth'] {
  const lpLocked = input.lpBurned ? 8 : input.lpLockMonths >= 6 ? 6 : input.lpLockMonths > 0 ? 3 : 0
  const mintRenounced = input.mintRenounced ? 5 : 0
  const freezeDisabled = input.freezeDisabled ? 5 : 0
  const devWalletPct =
    input.devWalletPct < 2 ? 7 : input.devWalletPct < 5 ? 4 : input.devWalletPct < 10 ? 1 : 0

  const bundlePenalty = input.bundledLaunch ? -15 : 0
  const sniperPenalty = -Math.min(input.sniperCount, 10)
  const insiderPenalty = input.insiderWalletsDetected ? -10 : 0

  const raw = lpLocked + mintRenounced + freezeDisabled + devWalletPct + bundlePenalty + sniperPenalty + insiderPenalty
  const total = scaleToWeight(clamp(raw, 0, 25), 25, input.weights.token_health)

  return { lpLocked, mintRenounced, freezeDisabled, devWalletPct, bundlePenalty, sniperPenalty, insiderPenalty, total }
}

export function scoreMomentum(input: MomentumInput): ScoreBreakdown['momentum'] {
  const volumeMcapRatio =
    input.volumeMcapRatio > 0.5 ? 8
    : input.volumeMcapRatio > 0.2 ? 5
    : input.volumeMcapRatio > 0.05 ? 2
    : 0

  const holderGrowthRate =
    input.newHoldersPerMin > 10 ? 7
    : input.newHoldersPerMin > 5 ? 4
    : input.newHoldersPerMin > 1 ? 1
    : 0

  const buySellRatio =
    input.buySellRatio > 3 ? 5
    : input.buySellRatio > 2 ? 3
    : input.buySellRatio > 1.5 ? 1
    : 0

  const socialLinks = input.socialLinksLive >= 2 ? 3 : input.socialLinksLive === 1 ? 1 : 0
  const migration = input.isPumpFunToRaydiumMigration ? 2 : 0
  const washTradePenalty = input.washTradeDetected ? -8 : 0
  const botActivityPenalty = input.volumeSpikeNoNewWallets ? -5 : 0

  const raw = volumeMcapRatio + holderGrowthRate + buySellRatio + socialLinks + migration + washTradePenalty + botActivityPenalty
  const total = scaleToWeight(clamp(raw, 0, 25), 25, input.weights.momentum)

  return { volumeMcapRatio, holderGrowthRate, buySellRatio, socialLinks, migration, washTradePenalty, botActivityPenalty, total }
}

export function scoreDeployer(input: DeployerInput): ScoreBreakdown['deployer'] {
  const previousOutcomes =
    input.previousTokenCount === 0 ? 3
    : input.previousRunnerPct > 0.6 ? 10
    : input.previousRunnerPct > 0.4 ? 5
    : 0

  const walletAge =
    input.walletAgeDays > 90 ? 5
    : input.walletAgeDays > 30 ? 3
    : input.walletAgeDays > 7 ? 1
    : 0

  const solBalance =
    input.deployerSolBalance > 5 ? 5
    : input.deployerSolBalance > 1 ? 3
    : 0

  const raw = previousOutcomes + walletAge + solBalance
  const total = scaleToWeight(clamp(raw, 0, 20), 20, input.weights.deployer)

  return { previousOutcomes, walletAge, solBalance, total }
}

export function scoreSocialBonus(input: SocialBonusInput): number {
  if (!input.enabled) return 0

  const nameLower = input.tokenNameAndDescription.toLowerCase()
  const hasNarrativeMatch = input.narrativeKeywords.some((kw) =>
    nameLower.includes(kw.toLowerCase())
  )
  const narrativePts = hasNarrativeMatch ? 2 : 0

  let telegramPts = 0
  if (input.telegramMemberCount > 0) telegramPts += 0.5
  if (input.telegramMemberCount > 500) telegramPts += 0.5
  if (input.telegramMemberGrowthPerHour > 50) telegramPts += 0.5

  const coinGeckoPts = input.isCoinGeckoTrending ? 1 : 0

  return Math.min(5, Math.round(narrativePts + telegramPts + coinGeckoPts))
}

export function computeCompositeScore(input: SignalEngineInput): ScoreBreakdown {
  const smartMoney = scoreSmartMoney(input.smartMoney)
  const tokenHealth = scoreTokenHealth(input.tokenHealth)
  const momentum = scoreMomentum(input.momentum)
  const deployer = scoreDeployer(input.deployer)
  const socialBonus = scoreSocialBonus(input.social)

  const base = smartMoney.total + tokenHealth.total + momentum.total + deployer.total
  const composite = clamp(base + socialBonus, 0, 100)

  return { smartMoney, tokenHealth, momentum, deployer, socialBonus, composite }
}
