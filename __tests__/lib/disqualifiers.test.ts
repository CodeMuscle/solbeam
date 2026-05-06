import { checkDisqualifiers, type DisqualifierInput } from '@/lib/disqualifiers'

function makeInput(overrides: Partial<DisqualifierInput> = {}): DisqualifierInput {
  return {
    top10HolderPct: 30,
    sniperWalletPct: 10,
    devSoldPct: 5,
    deployerRugCount: 0,
    bundledLaunch: false,
    mintRenounced: true,
    tokenAgeMinutes: 5,
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
