import type { Token, ScoreBreakdown } from '@/lib/types'

interface Props {
  token: Token
}

function RiskItem({ label, isRisk }: { label: string; isRisk: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      <span className={isRisk ? 'text-red-400' : 'text-green-400'}>
        {isRisk ? '⛔' : '✅'}
      </span>
      <span className={isRisk ? 'text-[#888]' : 'text-[#555]'}>{label}</span>
    </div>
  )
}

export function RiskPanel({ token }: Props) {
  const bd = token.score_breakdown as ScoreBreakdown | null

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Risk Assessment</h3>

      {token.disqualified && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
          ⛔ Disqualified: {token.disqualify_reason}
        </div>
      )}

      <RiskItem label="Mint authority renounced" isRisk={!token.mint_renounced} />
      <RiskItem label="Freeze authority disabled" isRisk={!token.freeze_disabled} />
      <RiskItem label="LP locked or burned" isRisk={!token.lp_locked} />
      <RiskItem
        label={`Dev wallet: ${token.dev_wallet_pct?.toFixed(1) ?? '?'}% of supply`}
        isRisk={(token.dev_wallet_pct ?? 0) > 5}
      />

      {bd && bd.tokenHealth.bundlePenalty < 0 && (
        <RiskItem label="Bundled launch detected" isRisk={true} />
      )}
      {bd && bd.tokenHealth.sniperPenalty < -3 && (
        <RiskItem label="Sniper wallets present" isRisk={true} />
      )}
      {bd && bd.momentum.washTradePenalty < 0 && (
        <RiskItem label="Wash trading detected" isRisk={true} />
      )}
    </div>
  )
}
