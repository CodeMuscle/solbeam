import {
  checkExitConditions,
  calcPnlPct,
  calcMultiplier,
  type ExitCheckInput,
} from '@/lib/exit-monitor'

function makeInput(overrides: Partial<ExitCheckInput> = {}): ExitCheckInput {
  return {
    entryPriceUsd: 1.0,
    currentPriceUsd: 1.0,
    takeProfitTiers: [1.5, 3.0, 10.0],
    stopLossPct: 30,
    stopLossEnabled: true,
    breakEvenFeePct: 0.5,
    alreadyAlertedTiers: new Set(),
    ...overrides,
  }
}

describe('calcPnlPct', () => {
  it('returns 0 at entry price', () => {
    expect(calcPnlPct(1.0, 1.0)).toBe(0)
  })

  it('returns 100 at 2x', () => {
    expect(calcPnlPct(1.0, 2.0)).toBeCloseTo(100)
  })

  it('returns -50 at 0.5x', () => {
    expect(calcPnlPct(1.0, 0.5)).toBeCloseTo(-50)
  })
})

describe('calcMultiplier', () => {
  it('returns 1 at entry price', () => {
    expect(calcMultiplier(1.0, 1.0)).toBe(1)
  })

  it('returns 10 at 10x price', () => {
    expect(calcMultiplier(1.0, 10.0)).toBe(10)
  })
})

describe('checkExitConditions', () => {
  it('returns null when price is at entry and no conditions triggered', () => {
    const result = checkExitConditions(makeInput())
    expect(result).toBeNull()
  })

  it('fires MOONSHOT at 10x (take-profit tier 3)', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 10.5 }))
    expect(result).not.toBeNull()
    expect(result!.type).toBe('MOONSHOT')
    expect(result!.multiplier).toBeCloseTo(10.5)
  })

  it('fires RUNNER at 3x (take-profit tier 2)', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 3.5 }))
    expect(result!.type).toBe('RUNNER')
  })

  it('fires MODERATE_PUMP at 1.5x (take-profit tier 1)', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 1.6 }))
    expect(result!.type).toBe('MODERATE_PUMP')
  })

  it('fires BREAK_EVEN when price drops to entry + 0.5% fee', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 1.004 }))
    expect(result!.type).toBe('BREAK_EVEN')
  })

  it('fires STOP_LOSS when price drops -30%', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 0.69 }))
    expect(result!.type).toBe('STOP_LOSS')
  })

  it('does NOT fire a tier alert that was already alerted', () => {
    const alreadyAlertedTiers = new Set<string>(['MOONSHOT'])
    const result = checkExitConditions(
      makeInput({ currentPriceUsd: 12.0, alreadyAlertedTiers })
    )
    expect(result).toBeNull()
  })

  it('does NOT fire stop-loss when disabled', () => {
    const result = checkExitConditions(
      makeInput({ currentPriceUsd: 0.5, stopLossEnabled: false })
    )
    expect(result?.type).not.toBe('STOP_LOSS')
  })
})
