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
  { check: (i) => i.top10HolderPct > 70, reason: 'Top-10 wallets hold > 70% of supply' },
  { check: (i) => i.sniperWalletPct > 30, reason: 'Sniper wallets hold > 30% of supply' },
  { check: (i) => i.devSoldPct > 50, reason: 'Dev wallet sold > 50% of allocation' },
  { check: (i) => i.deployerRugCount >= 2, reason: 'Deployer address rugged 2+ previous tokens' },
  { check: (i) => i.bundledLaunch, reason: 'Bundled launch detected' },
  { check: (i) => !i.mintRenounced && i.tokenAgeMinutes > 10, reason: 'Mint authority not renounced (token > 10 minutes old)' },
]

export function checkDisqualifiers(input: DisqualifierInput): DisqualifyReason | null {
  for (const rule of RULES) {
    if (rule.check(input)) return rule.reason
  }
  return null
}
