export interface ExitCheckInput {
  entryPriceUsd: number
  currentPriceUsd: number
  takeProfitTiers: number[]
  stopLossPct: number
  stopLossEnabled: boolean
  breakEvenFeePct: number
  alreadyAlertedTiers: Set<string>
}

export type ExitConditionType =
  | 'MOONSHOT'
  | 'RUNNER'
  | 'MODERATE_PUMP'
  | 'BREAK_EVEN'
  | 'STOP_LOSS'

export interface ExitCondition {
  type: ExitConditionType
  multiplier: number
  pnlPct: number
}

const TIER_NAMES: Record<number, ExitConditionType> = {
  0: 'MODERATE_PUMP',
  1: 'RUNNER',
  2: 'MOONSHOT',
}

export function calcPnlPct(entryPrice: number, currentPrice: number): number {
  return ((currentPrice - entryPrice) / entryPrice) * 100
}

export function calcMultiplier(entryPrice: number, currentPrice: number): number {
  return currentPrice / entryPrice
}

export function checkExitConditions(input: ExitCheckInput): ExitCondition | null {
  const multiplier = calcMultiplier(input.entryPriceUsd, input.currentPriceUsd)
  const pnlPct = calcPnlPct(input.entryPriceUsd, input.currentPriceUsd)
  const breakEvenFloor = input.entryPriceUsd * (1 + input.breakEvenFeePct / 100)

  const sortedTiers = [...input.takeProfitTiers].sort((a, b) => b - a)
  for (let i = 0; i < sortedTiers.length; i++) {
    const tierMultiplier = sortedTiers[i]
    const tierName = TIER_NAMES[sortedTiers.length - 1 - i] ?? 'MODERATE_PUMP'

    if (multiplier >= tierMultiplier) {
      if (input.alreadyAlertedTiers.has(tierName)) return null
      return { type: tierName, multiplier, pnlPct }
    }
  }

  if (
    input.currentPriceUsd > input.entryPriceUsd &&
    input.currentPriceUsd <= breakEvenFloor &&
    !input.alreadyAlertedTiers.has('BREAK_EVEN')
  ) {
    return { type: 'BREAK_EVEN', multiplier, pnlPct }
  }

  if (
    input.stopLossEnabled &&
    pnlPct <= -input.stopLossPct &&
    !input.alreadyAlertedTiers.has('STOP_LOSS')
  ) {
    return { type: 'STOP_LOSS', multiplier, pnlPct }
  }

  return null
}
