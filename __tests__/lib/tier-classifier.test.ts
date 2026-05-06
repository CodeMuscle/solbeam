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
