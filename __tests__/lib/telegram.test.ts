import { formatExitAlert, formatBreakEvenAlert } from '@/lib/telegram'

describe('formatExitAlert', () => {
  it('formats a MOONSHOT alert correctly', () => {
    const msg = formatExitAlert({
      symbol: 'WOJAK',
      tier: 'MOONSHOT',
      multiplier: 10.5,
      entryPrice: 0.001,
      currentPrice: 0.0105,
    })
    expect(msg).toContain('MOONSHOT')
    expect(msg).toContain('WOJAK')
    expect(msg).toContain('10.5x')
  })

  it('formats a RUNNER alert correctly', () => {
    const msg = formatExitAlert({
      symbol: 'DOGE2',
      tier: 'RUNNER',
      multiplier: 4.2,
      entryPrice: 0.0005,
      currentPrice: 0.0021,
    })
    expect(msg).toContain('RUNNER')
    expect(msg).toContain('4.2x')
  })
})

describe('formatBreakEvenAlert', () => {
  it('formats a break-even alert with symbol and price', () => {
    const msg = formatBreakEvenAlert({ symbol: 'WOJAK', currentPrice: 0.001005 })
    expect(msg).toContain('BREAK-EVEN')
    expect(msg).toContain('WOJAK')
  })
})
