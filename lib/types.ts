export type TokenSource = 'pump_fun' | 'raydium' | 'trending'

export type OutcomeTier =
  | 'MOONSHOT'
  | 'RUNNER'
  | 'MODERATE_PUMP'
  | 'FLAT'
  | 'DUMP'
  | 'RUG'

export type PositionMode = 'paper' | 'real'
export type PositionStatus = 'open' | 'closed'
export type TransactionType = 'buy' | 'sell' | 'transfer'

export interface ScoreBreakdown {
  smartMoney: {
    walletCount: number
    recency: number
    winRate: number
    clusterPenalty: number
    total: number
  }
  tokenHealth: {
    lpLocked: number
    mintRenounced: number
    freezeDisabled: number
    devWalletPct: number
    bundlePenalty: number
    sniperPenalty: number
    insiderPenalty: number
    total: number
  }
  momentum: {
    volumeMcapRatio: number
    holderGrowthRate: number
    buySellRatio: number
    socialLinks: number
    migration: number
    washTradePenalty: number
    botActivityPenalty: number
    total: number
  }
  deployer: {
    previousOutcomes: number
    walletAge: number
    solBalance: number
    total: number
  }
  socialBonus: number
  composite: number
}

export interface Token {
  mint: string
  symbol: string | null
  name: string | null
  source: TokenSource
  score: number
  disqualified: boolean
  disqualify_reason: string | null
  tier: OutcomeTier | null
  price_usd: number | null
  market_cap_usd: number | null
  volume_24h_usd: number | null
  liquidity_usd: number | null
  holder_count: number | null
  lp_locked: boolean | null
  mint_renounced: boolean | null
  freeze_disabled: boolean | null
  dev_wallet_pct: number | null
  smart_money_count: number
  deployer_address: string | null
  score_breakdown: ScoreBreakdown | null
  pair_created_at: string | null
  socials: Array<{ type: string; url: string }> | null
  websites: Array<{ url: string; label?: string }> | null
  image_url: string | null
  bonding_curve_pct: number | null
  created_at: string
  updated_at: string
}

export interface TrackedWallet {
  id: string
  address: string
  label: string | null
  win_rate: number | null
  estimated_pnl_usd: number | null
  helius_webhook_id: string | null
  created_at: string
}

export interface WalletTransaction {
  id: string
  wallet_address: string
  signature: string
  type: TransactionType
  token_mint: string | null
  token_symbol: string | null
  amount_usd: number | null
  dex: string | null
  timestamp: string
}

export interface Position {
  id: string
  token_mint: string
  token_symbol: string | null
  mode: PositionMode
  entry_price_usd: number
  entry_timestamp: string
  entry_score: number | null
  exit_price_usd: number | null
  exit_timestamp: string | null
  outcome_tier: OutcomeTier | null
  pnl_pct: number | null
  status: PositionStatus
  notes: string | null
}

export interface SignalWeights {
  smart_money: number
  token_health: number
  momentum: number
  deployer: number
}

export interface Settings {
  id: number
  signal_weights: SignalWeights
  social_signal_enabled: boolean
  narrative_keywords: string[]
  min_alert_score: number
  take_profit_tiers: number[]
  stop_loss_pct: number
  break_even_fee_pct: number
  telegram_bot_token: string | null
  telegram_chat_id: string | null
  data_retention_days: number
}
