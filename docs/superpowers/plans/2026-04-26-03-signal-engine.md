# SolBeam — Plan 3: Signal Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the signal engine — the core intelligence of SolBeam. Implements hard disqualifiers, the composite 0–100 score calculator (4 categories + optional social bonus), the outcome tier classifier, and the API route that scores a token on demand.

**Architecture:** Pure TypeScript functions with no side effects — each function takes plain data objects and returns scores or classifications. This makes them trivially testable. The API route at `/api/tokens/[mint]` wires the signal engine to the data sources and writes the result back to Supabase. The cron job (Plan 2) already upserts raw token data — this plan adds the scoring step on top.

**Tech Stack:** TypeScript (pure functions), Supabase (reads token data, writes scores), Helius DAS API (holder/metadata), DexScreener (live pair data).

**Prerequisite:** Plans 1 and 2 complete. `lib/types.ts`, `lib/dexscreener.ts`, `lib/helius.ts`, `lib/supabase/admin.ts` all exist.

---

## File Map

| File | Responsibility |
|---|---|
| `lib/disqualifiers.ts` | Hard veto rules — returns first failed check or null |
| `lib/signal-engine.ts` | Composite score calculator (4 categories + social bonus) |
| `lib/tier-classifier.ts` | Maps price-change multiplier → OutcomeTier label |
| `app/api/tokens/[mint]/route.ts` | Fetches token data, runs signal engine, writes to DB |
| `__tests__/lib/disqualifiers.test.ts` | Unit tests for all 6 disqualifier rules |
| `__tests__/lib/signal-engine.test.ts` | Unit tests for each score category + composite |
| `__tests__/lib/tier-classifier.test.ts` | Unit tests for tier classification boundaries |

---

### Task 1: Hard Disqualifier Rules (TDD)

**Files:**
- Create: `lib/disqualifiers.ts`
- Create: `__tests__/lib/disqualifiers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/disqualifiers.test.ts`:

```typescript
import { checkDisqualifiers, type DisqualifierInput } from '@/lib/disqualifiers'

function makeInput(overrides: Partial<DisqualifierInput> = {}): DisqualifierInput {
  return {
    top10HolderPct: 30,          // healthy: 30% across top 10
    sniperWalletPct: 10,         // healthy: 10% held by snipers
    devSoldPct: 5,               // healthy: dev sold only 5%
    deployerRugCount: 0,         // healthy: no prior rugs
    bundledLaunch: false,        // healthy: not bundled
    mintRenounced: true,         // healthy: renounced
    tokenAgeMinutes: 5,          // 5 minutes old
    ...overrides,
  }
}

describe('checkDisqualifiers', () => {
  it('returns null when all checks pass (healthy token)', () => {
    expect(checkDisqualifiers(makeInput())).toBeNull()
  })

  it('disqualifies when top-10 wallets hold > 70% of supply', () => {
    const result = checkDisqualifiers(makeInput({ top10HolderPct: 71 }))
    expect(result).toBe('Top-10 wallets hold > 70% of supply')
  })

  it('disqualifies when sniper wallets hold > 30% of supply', () => {
    const result = checkDisqualifiers(makeInput({ sniperWalletPct: 31 }))
    expect(result).toBe('Sniper wallets hold > 30% of supply')
  })

  it('disqualifies when dev wallet sold > 50% of allocation', () => {
    const result = checkDisqualifiers(makeInput({ devSoldPct: 51 }))
    expect(result).toBe('Dev wallet sold > 50% of allocation')
  })

  it('disqualifies when deployer rugged 2 or more previous tokens', () => {
    const result = checkDisqualifiers(makeInput({ deployerRugCount: 2 }))
    expect(result).toBe('Deployer address rugged 2+ previous tokens')
  })

  it('disqualifies on bundled launch', () => {
    const result = checkDisqualifiers(makeInput({ bundledLaunch: true }))
    expect(result).toBe('Bundled launch detected')
  })

  it('disqualifies when mint not renounced and token > 10 minutes old', () => {
    const result = checkDisqualifiers(
      makeInput({ mintRenounced: false, tokenAgeMinutes: 11 })
    )
    expect(result).toBe('Mint authority not renounced (token > 10 minutes old)')
  })

  it('does NOT disqualify when mint not renounced but token is < 10 minutes old', () => {
    const result = checkDisqualifiers(
      makeInput({ mintRenounced: false, tokenAgeMinutes: 9 })
    )
    expect(result).toBeNull()
  })

  it('returns the first failing check, not all of them', () => {
    const result = checkDisqualifiers(
      makeInput({ top10HolderPct: 80, sniperWalletPct: 40 })
    )
    expect(result).toBe('Top-10 wallets hold > 70% of supply')
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/disqualifiers.test.ts
```

Expected: `Cannot find module '@/lib/disqualifiers'`

- [ ] **Step 3: Implement lib/disqualifiers.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/disqualifiers.ts`:

```typescript
export interface DisqualifierInput {
  top10HolderPct: number
  sniperWalletPct: number
  devSoldPct: number
  deployerRugCount: number
  bundledLaunch: boolean
  mintRenounced: boolean
  tokenAgeMinutes: number
}

type DisqualifyReason =
  | 'Top-10 wallets hold > 70% of supply'
  | 'Sniper wallets hold > 30% of supply'
  | 'Dev wallet sold > 50% of allocation'
  | 'Deployer address rugged 2+ previous tokens'
  | 'Bundled launch detected'
  | 'Mint authority not renounced (token > 10 minutes old)'

const RULES: Array<{ check: (i: DisqualifierInput) => boolean; reason: DisqualifyReason }> = [
  {
    check: (i) => i.top10HolderPct > 70,
    reason: 'Top-10 wallets hold > 70% of supply',
  },
  {
    check: (i) => i.sniperWalletPct > 30,
    reason: 'Sniper wallets hold > 30% of supply',
  },
  {
    check: (i) => i.devSoldPct > 50,
    reason: 'Dev wallet sold > 50% of allocation',
  },
  {
    check: (i) => i.deployerRugCount >= 2,
    reason: 'Deployer address rugged 2+ previous tokens',
  },
  {
    check: (i) => i.bundledLaunch,
    reason: 'Bundled launch detected',
  },
  {
    check: (i) => !i.mintRenounced && i.tokenAgeMinutes > 10,
    reason: 'Mint authority not renounced (token > 10 minutes old)',
  },
]

export function checkDisqualifiers(input: DisqualifierInput): DisqualifyReason | null {
  for (const rule of RULES) {
    if (rule.check(input)) return rule.reason
  }
  return null
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/disqualifiers.test.ts
```

Expected:
```
PASS __tests__/lib/disqualifiers.test.ts
  checkDisqualifiers
    ✓ returns null when all checks pass (healthy token)
    ✓ disqualifies when top-10 wallets hold > 70% of supply
    ✓ disqualifies when sniper wallets hold > 30% of supply
    ✓ disqualifies when dev wallet sold > 50% of allocation
    ✓ disqualifies when deployer rugged 2 or more previous tokens
    ✓ disqualifies on bundled launch
    ✓ disqualifies when mint not renounced and token > 10 minutes old
    ✓ does NOT disqualify when mint not renounced but token is < 10 minutes old
    ✓ returns the first failing check, not all of them

Tests: 9 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/disqualifiers.ts __tests__/lib/disqualifiers.test.ts
git commit -m "feat: add hard disqualifier rules with 9 tests"
```

---

### Task 2: Tier Classifier (TDD)

**Files:**
- Create: `lib/tier-classifier.ts`
- Create: `__tests__/lib/tier-classifier.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/tier-classifier.test.ts`:

```typescript
import { classifyTier } from '@/lib/tier-classifier'

describe('classifyTier', () => {
  it('returns MOONSHOT at 10x or above', () => {
    expect(classifyTier(10)).toBe('MOONSHOT')
    expect(classifyTier(50)).toBe('MOONSHOT')
  })

  it('returns RUNNER between 3x and 10x (exclusive)', () => {
    expect(classifyTier(3)).toBe('RUNNER')
    expect(classifyTier(5)).toBe('RUNNER')
    expect(classifyTier(9.99)).toBe('RUNNER')
  })

  it('returns MODERATE_PUMP between 1.5x and 3x (exclusive)', () => {
    expect(classifyTier(1.5)).toBe('MODERATE_PUMP')
    expect(classifyTier(2)).toBe('MODERATE_PUMP')
    expect(classifyTier(2.99)).toBe('MODERATE_PUMP')
  })

  it('returns FLAT between -20% and +50% change', () => {
    expect(classifyTier(1.0)).toBe('FLAT')
    expect(classifyTier(1.49)).toBe('FLAT')
    expect(classifyTier(0.85)).toBe('FLAT')
    expect(classifyTier(0.8)).toBe('FLAT')
  })

  it('returns DUMP between -20% and -70% drop', () => {
    expect(classifyTier(0.79)).toBe('DUMP')
    expect(classifyTier(0.5)).toBe('DUMP')
    expect(classifyTier(0.31)).toBe('DUMP')
  })

  it('returns RUG below -70% (less than 0.30x)', () => {
    expect(classifyTier(0.3)).toBe('RUG')
    expect(classifyTier(0.1)).toBe('RUG')
    expect(classifyTier(0)).toBe('RUG')
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/tier-classifier.test.ts
```

Expected: `Cannot find module '@/lib/tier-classifier'`

- [ ] **Step 3: Implement lib/tier-classifier.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/tier-classifier.ts`:

```typescript
import type { OutcomeTier } from './types'

export function classifyTier(priceMultiplier: number): OutcomeTier {
  if (priceMultiplier >= 10) return 'MOONSHOT'
  if (priceMultiplier >= 3) return 'RUNNER'
  if (priceMultiplier >= 1.5) return 'MODERATE_PUMP'
  if (priceMultiplier >= 0.8) return 'FLAT'
  if (priceMultiplier >= 0.3) return 'DUMP'
  return 'RUG'
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/tier-classifier.test.ts
```

Expected:
```
PASS __tests__/lib/tier-classifier.test.ts
  classifyTier
    ✓ returns MOONSHOT at 10x or above
    ✓ returns RUNNER between 3x and 10x (exclusive)
    ✓ returns MODERATE_PUMP between 1.5x and 3x (exclusive)
    ✓ returns FLAT between -20% and +50% change
    ✓ returns DUMP between -20% and -70% drop
    ✓ returns RUG below -70%

Tests: 6 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/tier-classifier.ts __tests__/lib/tier-classifier.test.ts
git commit -m "feat: add tier classifier with 6 boundary tests"
```

---

### Task 3: Composite Score Calculator (TDD)

**Files:**
- Create: `lib/signal-engine.ts`
- Create: `__tests__/lib/signal-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/signal-engine.test.ts`:

```typescript
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

// ── Smart Money ──────────────────────────────────────────────────────────────

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

// ── Token Health ─────────────────────────────────────────────────────────────

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

// ── Momentum ─────────────────────────────────────────────────────────────────

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

// ── Deployer ─────────────────────────────────────────────────────────────────

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

// ── Social Bonus ─────────────────────────────────────────────────────────────

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
    expect(
      scoreSocialBonus({ ...base, isCoinGeckoTrending: true })
    ).toBe(1)
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

// ── Composite ────────────────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/signal-engine.test.ts
```

Expected: `Cannot find module '@/lib/signal-engine'`

- [ ] **Step 3: Implement lib/signal-engine.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/signal-engine.ts`:

```typescript
import type { SignalWeights, ScoreBreakdown } from './types'

// ── Input types ───────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function scaleToWeight(rawPts: number, maxRawPts: number, weight: number): number {
  return Math.round((rawPts / maxRawPts) * weight)
}

// ── Category scorers ─────────────────────────────────────────────────────────

export function scoreSmartMoney(
  input: SmartMoneyInput
): ScoreBreakdown['smartMoney'] {
  const walletCount =
    input.walletCount >= 3 ? 15 : input.walletCount === 2 ? 10 : input.walletCount === 1 ? 5 : 0

  const recency =
    input.minutesSinceFirstEntry < 2
      ? 10
      : input.minutesSinceFirstEntry < 10
      ? 6
      : input.minutesSinceFirstEntry < 30
      ? 2
      : 0

  const winRate =
    input.avgWalletWinRate > 0.65 ? 5 : input.avgWalletWinRate > 0.5 ? 3 : 0

  const clusterPenalty = input.isClustered ? -10 : 0

  const raw = walletCount + recency + winRate + clusterPenalty
  const total = scaleToWeight(clamp(raw, 0, 30), 30, input.weights.smart_money)

  return { walletCount, recency, winRate, clusterPenalty, total }
}

export function scoreTokenHealth(
  input: TokenHealthInput
): ScoreBreakdown['tokenHealth'] {
  const lpLocked = input.lpBurned
    ? 8
    : input.lpLockMonths >= 6
    ? 6
    : input.lpLockMonths > 0
    ? 3
    : 0

  const mintRenounced = input.mintRenounced ? 5 : 0
  const freezeDisabled = input.freezeDisabled ? 5 : 0
  const devWalletPct =
    input.devWalletPct < 2
      ? 7
      : input.devWalletPct < 5
      ? 4
      : input.devWalletPct < 10
      ? 1
      : 0

  const bundlePenalty = input.bundledLaunch ? -15 : 0
  const sniperPenalty = -Math.min(input.sniperCount, 10)
  const insiderPenalty = input.insiderWalletsDetected ? -10 : 0

  const raw = lpLocked + mintRenounced + freezeDisabled + devWalletPct + bundlePenalty + sniperPenalty + insiderPenalty
  const total = scaleToWeight(clamp(raw, 0, 25), 25, input.weights.token_health)

  return { lpLocked, mintRenounced, freezeDisabled, devWalletPct, bundlePenalty, sniperPenalty, insiderPenalty, total }
}

export function scoreMomentum(
  input: MomentumInput
): ScoreBreakdown['momentum'] {
  const volumeMcapRatio =
    input.volumeMcapRatio > 0.5
      ? 8
      : input.volumeMcapRatio > 0.2
      ? 5
      : input.volumeMcapRatio > 0.05
      ? 2
      : 0

  const holderGrowthRate =
    input.newHoldersPerMin > 10
      ? 7
      : input.newHoldersPerMin > 5
      ? 4
      : input.newHoldersPerMin > 1
      ? 1
      : 0

  const buySellRatio =
    input.buySellRatio > 3
      ? 5
      : input.buySellRatio > 2
      ? 3
      : input.buySellRatio > 1.5
      ? 1
      : 0

  const socialLinks =
    input.socialLinksLive >= 2 ? 3 : input.socialLinksLive === 1 ? 1 : 0

  const migration = input.isPumpFunToRaydiumMigration ? 2 : 0
  const washTradePenalty = input.washTradeDetected ? -8 : 0
  const botActivityPenalty = input.volumeSpikeNoNewWallets ? -5 : 0

  const raw = volumeMcapRatio + holderGrowthRate + buySellRatio + socialLinks + migration + washTradePenalty + botActivityPenalty
  const total = scaleToWeight(clamp(raw, 0, 25), 25, input.weights.momentum)

  return { volumeMcapRatio, holderGrowthRate, buySellRatio, socialLinks, migration, washTradePenalty, botActivityPenalty, total }
}

export function scoreDeployer(
  input: DeployerInput
): ScoreBreakdown['deployer'] {
  const previousOutcomes =
    input.previousTokenCount === 0
      ? 3
      : input.previousRunnerPct > 0.6
      ? 10
      : input.previousRunnerPct > 0.4
      ? 5
      : 0

  const walletAge =
    input.walletAgeDays > 90
      ? 5
      : input.walletAgeDays > 30
      ? 3
      : input.walletAgeDays > 7
      ? 1
      : 0

  const solBalance =
    input.deployerSolBalance > 5
      ? 5
      : input.deployerSolBalance > 1
      ? 3
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

// ── Composite scorer ──────────────────────────────────────────────────────────

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
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/signal-engine.test.ts
```

Expected:
```
PASS __tests__/lib/signal-engine.test.ts
Tests: 18 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/signal-engine.ts __tests__/lib/signal-engine.test.ts
git commit -m "feat: add composite signal engine (4 categories + social bonus, 18 tests)"
```

---

### Task 4: Token Score API Route

**Files:**
- Modify: `app/api/tokens/[mint]/route.ts`

- [ ] **Step 1: Implement the token score API route**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/api/tokens/[mint]/route.ts`:

```typescript
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

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { mint } = await params

  // Check Redis cache first
  const cached = await getCachedToken(mint)
  if (cached?.score && cached.score > 0) {
    return NextResponse.json(cached)
  }

  // Fetch settings for weights and social config
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

  // Fetch on-chain data in parallel
  const [pair, livePrice, metadata] = await Promise.all([
    fetchTokenPair(mint),
    fetchPrice(mint),
    getTokenMetadata(mint),
  ])

  if (!pair) {
    return NextResponse.json({ error: 'Token not found on DexScreener' }, { status: 404 })
  }

  // Fetch smart money count from DB
  const { count: smartMoneyCount } = await supabaseAdmin
    .from('wallet_transactions')
    .select('wallet_address', { count: 'exact', head: true })
    .eq('token_mint', mint)
    .eq('type', 'buy')

  const tokenAgeMinutes = pair.pairCreatedAt
    ? (Date.now() - pair.pairCreatedAt) / 60_000
    : 999

  // Build disqualifier input from available data (default safe values when data not yet fetched)
  const dqResult = checkDisqualifiers({
    top10HolderPct: metadata?.tokenInfo?.concentrationRisk ?? 0,
    sniperWalletPct: 0,
    devSoldPct: 0,
    deployerRugCount: 0,
    bundledLaunch: false,
    mintRenounced: metadata?.onChainInfo?.mintAuthority === null,
    tokenAgeMinutes,
  })

  // Build signal engine input
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
    tier: classifyTier(livePrice && pair.priceUsd
      ? parseFloat(pair.priceUsd) / (livePrice || parseFloat(pair.priceUsd))
      : 1),
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

  // Write to score_history for backtester calibration
  await supabaseAdmin.from('score_history').insert({
    token_mint: mint,
    score: tokenRecord.score,
    score_breakdown: scoreBreakdown,
    weights_snapshot: weights,
    actual_outcome: null,  // filled in later when price outcome is known
    peak_multiplier: null,
  })

  await cacheToken(tokenRecord)

  return NextResponse.json(tokenRecord)
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/tokens/\[mint\]/route.ts
git commit -m "feat: implement token score API route wiring signal engine to Supabase"
```

---

### Task 5: Full Test Suite Verification

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected:
```
PASS __tests__/lib/env.test.ts           (5 tests)
PASS __tests__/lib/dexscreener.test.ts   (6 tests)
PASS __tests__/lib/jupiter.test.ts       (5 tests)
PASS __tests__/lib/helius.test.ts        (5 tests)
PASS __tests__/lib/ingest.test.ts        (3 tests)
PASS __tests__/lib/disqualifiers.test.ts (9 tests)
PASS __tests__/lib/tier-classifier.test.ts (6 tests)
PASS __tests__/lib/signal-engine.test.ts (18 tests)

Test Suites: 8 passed
Tests:       57 passed
```

- [ ] **Step 2: Run TypeScript check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both complete with no errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any build/test issues from Plan 3"
```

---

## Plan 3 Complete

At this point you have:
- Hard disqualifier rules (9 tests) — all 6 veto conditions
- Tier classifier (6 tests) — all 6 outcome tiers with correct boundaries
- Composite score calculator (18 tests) — all 4 categories + social bonus
- Token score API route that wires the full pipeline
- 57 total passing tests
- Clean build

**Next:** Plan 4 — Live Feed Dashboard (`/dashboard` page with Supabase Realtime + filter bar).
