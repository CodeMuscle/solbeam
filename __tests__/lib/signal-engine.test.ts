import {
  scoreSmartMoney,
  scoreTokenHealth,
  scoreMomentum,
  scoreDeployer,
  scoreSocialBonus,
  computeCompositeScore,
  type SmartMoneyInput,
  type TokenHealthInput,
  type MomentumInput,
  type DeployerInput,
  type SocialBonusInput,
  type SignalEngineInput,
} from '@/lib/signal-engine'

describe('scoreSmartMoney (max 30 pts)', () => {
  const base: SmartMoneyInput = {
    walletCount: 0,
    minutesSinceFirstEntry: 60,
    avgWalletWinRate: 0.4,
    isClustered: false,
    weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
  }

  it('returns 0 when no tracked wallets bought', () => {
    expect(scoreSmartMoney(base).total).toBe(0)
  })

  it('awards 15 pts for 3+ wallets, 10 pts for entry < 2 min, 5 pts for win rate > 65%', () => {
    const result = scoreSmartMoney({
      ...base,
      walletCount: 3,
      minutesSinceFirstEntry: 1,
      avgWalletWinRate: 0.7,
    })
    expect(result.walletCount).toBe(15)
    expect(result.recency).toBe(10)
    expect(result.winRate).toBe(5)
    expect(result.total).toBe(30)
  })

  it('awards 5 pts for 1 wallet', () => {
    const result = scoreSmartMoney({ ...base, walletCount: 1 })
    expect(result.walletCount).toBe(5)
  })

  it('applies -10 cluster penalty', () => {
    const result = scoreSmartMoney({
      ...base,
      walletCount: 3,
      minutesSinceFirstEntry: 1,
      avgWalletWinRate: 0.7,
      isClustered: true,
    })
    expect(result.clusterPenalty).toBe(-10)
    expect(result.total).toBe(20)
  })

  it('total is never negative', () => {
    const result = scoreSmartMoney({ ...base, walletCount: 1, isClustered: true })
    expect(result.total).toBeGreaterThanOrEqual(0)
  })
})

describe('scoreTokenHealth (max 25 pts)', () => {
  const base: TokenHealthInput = {
    lpBurned: false,
    lpLockMonths: 0,
    mintRenounced: false,
    freezeDisabled: false,
    devWalletPct: 15,
    bundledLaunch: false,
    sniperCount: 0,
    insiderWalletsDetected: false,
    weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
  }

  it('returns 0 for worst-case token (all flags bad)', () => {
    expect(scoreTokenHealth(base).total).toBe(0)
  })

  it('awards full 25 pts for a clean token', () => {
    const result = scoreTokenHealth({
      ...base,
      lpBurned: true,
      mintRenounced: true,
      freezeDisabled: true,
      devWalletPct: 1,
    })
    expect(result.total).toBe(25)
  })

  it('awards 8 pts for LP burned, 6 for locked >= 6 months, 3 for < 6 months', () => {
    expect(scoreTokenHealth({ ...base, lpBurned: true }).lpLocked).toBe(8)
    expect(scoreTokenHealth({ ...base, lpLockMonths: 6 }).lpLocked).toBe(6)
    expect(scoreTokenHealth({ ...base, lpLockMonths: 3 }).lpLocked).toBe(3)
  })

  it('applies bundle penalty of -15 pts', () => {
    const result = scoreTokenHealth({
      ...base,
      lpBurned: true,
      mintRenounced: true,
      freezeDisabled: true,
      devWalletPct: 1,
      bundledLaunch: true,
    })
    expect(result.bundlePenalty).toBe(-15)
    expect(result.total).toBe(10)
  })

  it('applies -1 pt per sniper, capped at -10', () => {
    const result = scoreTokenHealth({ ...base, sniperCount: 15 })
    expect(result.sniperPenalty).toBe(-10)
  })
})

describe('scoreMomentum (max 25 pts)', () => {
  const base: MomentumInput = {
    volumeMcapRatio: 0,
    newHoldersPerMin: 0,
    buySellRatio: 1,
    socialLinksLive: 0,
    isPumpFunToRaydiumMigration: false,
    washTradeDetected: false,
    volumeSpikeNoNewWallets: false,
    weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
  }

  it('returns 0 for flat momentum', () => {
    expect(scoreMomentum(base).total).toBe(0)
  })

  it('awards full 25 pts for peak momentum', () => {
    const result = scoreMomentum({
      ...base,
      volumeMcapRatio: 0.6,
      newHoldersPerMin: 15,
      buySellRatio: 4,
      socialLinksLive: 2,
      isPumpFunToRaydiumMigration: true,
    })
    expect(result.total).toBe(25)
  })

  it('awards 8 pts for volume/mcap > 0.5, 5 for > 0.2, 2 for > 0.05', () => {
    expect(scoreMomentum({ ...base, volumeMcapRatio: 0.6 }).volumeMcapRatio).toBe(8)
    expect(scoreMomentum({ ...base, volumeMcapRatio: 0.3 }).volumeMcapRatio).toBe(5)
    expect(scoreMomentum({ ...base, volumeMcapRatio: 0.1 }).volumeMcapRatio).toBe(2)
    expect(scoreMomentum({ ...base, volumeMcapRatio: 0.01 }).volumeMcapRatio).toBe(0)
  })

  it('applies -8 pt wash trade penalty', () => {
    const result = scoreMomentum({ ...base, volumeMcapRatio: 0.6, washTradeDetected: true })
    expect(result.washTradePenalty).toBe(-8)
  })
})

describe('scoreDeployer (max 20 pts)', () => {
  const base: DeployerInput = {
    previousRunnerPct: 0,
    previousTokenCount: 1,
    walletAgeDays: 0,
    deployerSolBalance: 0,
    weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
  }

  it('returns 3 pts for first-time deployer with 0 balance', () => {
    expect(scoreDeployer({ ...base, previousTokenCount: 0 }).previousOutcomes).toBe(3)
  })

  it('awards 10 pts for deployer with > 60% runner/moonshot history', () => {
    expect(scoreDeployer({ ...base, previousRunnerPct: 0.65 }).previousOutcomes).toBe(10)
  })

  it('awards 5 pts for wallet age > 90 days, 3 for > 30 days, 0 for < 7 days', () => {
    expect(scoreDeployer({ ...base, walletAgeDays: 91 }).walletAge).toBe(5)
    expect(scoreDeployer({ ...base, walletAgeDays: 31 }).walletAge).toBe(3)
    expect(scoreDeployer({ ...base, walletAgeDays: 6 }).walletAge).toBe(0)
  })
})

describe('scoreSocialBonus (max 5 pts)', () => {
  const base: SocialBonusInput = {
    narrativeKeywords: [],
    tokenNameAndDescription: '',
    telegramMemberCount: 0,
    telegramMemberGrowthPerHour: 0,
    isCoinGeckoTrending: false,
    enabled: true,
  }

  it('returns 0 when disabled', () => {
    expect(scoreSocialBonus({ ...base, enabled: false })).toBe(0)
  })

  it('awards 2 pts for narrative keyword match', () => {
    expect(
      scoreSocialBonus({
        ...base,
        narrativeKeywords: ['AI', 'DOG'],
        tokenNameAndDescription: 'AI Dog Coin',
      })
    ).toBeGreaterThanOrEqual(2)
  })

  it('awards 1 pt for CoinGecko trending', () => {
    expect(scoreSocialBonus({ ...base, isCoinGeckoTrending: true })).toBe(1)
  })

  it('caps total at 5 pts', () => {
    const score = scoreSocialBonus({
      ...base,
      narrativeKeywords: ['AI'],
      tokenNameAndDescription: 'AI Coin',
      telegramMemberCount: 600,
      telegramMemberGrowthPerHour: 60,
      isCoinGeckoTrending: true,
    })
    expect(score).toBeLessThanOrEqual(5)
  })
})

describe('computeCompositeScore', () => {
  const perfectInput: SignalEngineInput = {
    smartMoney: {
      walletCount: 3,
      minutesSinceFirstEntry: 1,
      avgWalletWinRate: 0.7,
      isClustered: false,
      weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
    },
    tokenHealth: {
      lpBurned: true,
      lpLockMonths: 0,
      mintRenounced: true,
      freezeDisabled: true,
      devWalletPct: 1,
      bundledLaunch: false,
      sniperCount: 0,
      insiderWalletsDetected: false,
      weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
    },
    momentum: {
      volumeMcapRatio: 0.6,
      newHoldersPerMin: 15,
      buySellRatio: 4,
      socialLinksLive: 2,
      isPumpFunToRaydiumMigration: true,
      washTradeDetected: false,
      volumeSpikeNoNewWallets: false,
      weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
    },
    deployer: {
      previousRunnerPct: 0.65,
      previousTokenCount: 5,
      walletAgeDays: 91,
      deployerSolBalance: 6,
      weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
    },
    social: {
      narrativeKeywords: ['AI'],
      tokenNameAndDescription: 'AI Coin',
      telegramMemberCount: 0,
      telegramMemberGrowthPerHour: 0,
      isCoinGeckoTrending: false,
      enabled: true,
    },
  }

  it('returns 100 for a perfect token', () => {
    const result = computeCompositeScore(perfectInput)
    expect(result.composite).toBe(100)
  })

  it('composite score is always between 0 and 100', () => {
    const worstInput: SignalEngineInput = {
      ...perfectInput,
      smartMoney: { ...perfectInput.smartMoney, walletCount: 0, isClustered: true },
      tokenHealth: { ...perfectInput.tokenHealth, lpBurned: false, bundledLaunch: true },
      momentum: { ...perfectInput.momentum, volumeMcapRatio: 0, washTradeDetected: true },
    }
    const result = computeCompositeScore(worstInput)
    expect(result.composite).toBeGreaterThanOrEqual(0)
    expect(result.composite).toBeLessThanOrEqual(100)
  })
})
