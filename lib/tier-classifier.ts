import type { OutcomeTier } from './types'

export function classifyTier(priceMultiplier: number): OutcomeTier {
  if (priceMultiplier >= 10) return 'MOONSHOT'
  if (priceMultiplier >= 3) return 'RUNNER'
  if (priceMultiplier >= 1.5) return 'MODERATE_PUMP'
  if (priceMultiplier >= 0.8) return 'FLAT'
  if (priceMultiplier > 0.3) return 'DUMP'
  return 'RUG'
}
