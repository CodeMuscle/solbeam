import type { ScoreBreakdown } from '@/lib/types'
import { ScorePill } from '@/components/feed/ScorePill'

interface CategoryRowProps {
  label: string
  pts: number
  maxPts: number
  signals: Array<{ name: string; pts: number }>
}

function CategoryRow({ label, pts, maxPts, signals }: CategoryRowProps) {
  const pct = maxPts > 0 ? Math.max(0, (pts / maxPts)) * 100 : 0

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#888] text-sm">{label}</span>
        <span className="text-[#ccc] text-sm font-mono tabular-nums">
          {pts}/{maxPts}
        </span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-green-500/50 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        {signals.map(({ name, pts: sigPts }) => (
          <div key={name} className="flex items-center justify-between text-xs py-0.5">
            <span className="text-[#555]">{name}</span>
            <span className={`tabular-nums ${sigPts >= 0 ? 'text-[#666]' : 'text-red-400'}`}>
              {sigPts >= 0 ? '+' : ''}{sigPts}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  breakdown: ScoreBreakdown
  totalScore: number
}

export function ScoreBreakdownPanel({ breakdown, totalScore }: Props) {
  const { smartMoney: sm, tokenHealth: th, momentum: mo, deployer: de, socialBonus } = breakdown

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#555] text-xs uppercase tracking-widest">Score Breakdown</h3>
        <ScorePill score={totalScore} />
      </div>

      <CategoryRow
        label="🐋 Smart Money"
        pts={sm.total}
        maxPts={30}
        signals={[
          { name: 'Wallet count', pts: sm.walletCount },
          { name: 'Entry recency', pts: sm.recency },
          { name: 'Win rate', pts: sm.winRate },
          { name: 'Cluster penalty', pts: sm.clusterPenalty },
        ]}
      />

      <CategoryRow
        label="🔒 Token Health"
        pts={th.total}
        maxPts={25}
        signals={[
          { name: 'LP locked/burned', pts: th.lpLocked },
          { name: 'Mint renounced', pts: th.mintRenounced },
          { name: 'Freeze disabled', pts: th.freezeDisabled },
          { name: 'Dev wallet %', pts: th.devWalletPct },
          { name: 'Bundle penalty', pts: th.bundlePenalty },
          { name: 'Sniper penalty', pts: th.sniperPenalty },
        ]}
      />

      <CategoryRow
        label="📈 Momentum"
        pts={mo.total}
        maxPts={25}
        signals={[
          { name: 'Vol/MCap ratio', pts: mo.volumeMcapRatio },
          { name: 'Holder growth', pts: mo.holderGrowthRate },
          { name: 'Buy/sell ratio', pts: mo.buySellRatio },
          { name: 'Social links', pts: mo.socialLinks },
          { name: 'Migration bonus', pts: mo.migration },
          { name: 'Wash trade', pts: mo.washTradePenalty },
        ]}
      />

      <CategoryRow
        label="🕵️ Deployer"
        pts={de.total}
        maxPts={20}
        signals={[
          { name: 'Past outcomes', pts: de.previousOutcomes },
          { name: 'Wallet age', pts: de.walletAge },
          { name: 'SOL balance', pts: de.solBalance },
        ]}
      />

      {socialBonus > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#111]">
          <span className="text-[#555] text-xs">✨ Social bonus</span>
          <span className="text-[#666] text-xs">+{socialBonus}</span>
        </div>
      )}
    </div>
  )
}
