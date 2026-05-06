import { ScorePill } from './ScorePill'
import { TierBadge } from './TierBadge'
import { SourceBadge } from './SourceBadge'
import { formatMarketCap, formatAge } from '@/lib/feed-utils'
import type { Token } from '@/lib/types'

interface Props {
  token: Token
  onClose: () => void
}

function ScoreRow({ label, pts, max }: { label: string; pts: number; max: number }) {
  const pct = max > 0 ? (pts / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#141414]">
      <span className="text-[#666] text-xs flex-1">{label}</span>
      <div className="w-24 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${Math.max(0, pct)}%` }} />
      </div>
      <span className="text-[#888] text-xs tabular-nums w-8 text-right">{pts}/{max}</span>
    </div>
  )
}

export function TokenDetailPanel({ token, onClose }: Props) {
  const bd = token.score_breakdown

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-[#0a0a0a] border-l border-[#1a1a1a] flex flex-col z-40 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1a1a1a]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{token.symbol}</span>
            <SourceBadge source={token.source} />
          </div>
          <span className="text-[#444] text-xs font-mono">{token.mint.slice(0, 16)}…</span>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-[#888] text-lg leading-none">✕</button>
      </div>

      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1a1a1a]">
        <ScorePill score={token.score} />
        <TierBadge tier={token.tier} />
        <span className="text-[#555] text-xs ml-auto">{formatAge(token.created_at)} ago</span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[#141414] border-b border-[#1a1a1a]">
        {[
          { label: 'Market Cap', value: formatMarketCap(token.market_cap_usd) },
          { label: 'Price', value: token.price_usd ? `$${token.price_usd.toPrecision(4)}` : '—' },
          { label: 'Volume 24h', value: formatMarketCap(token.volume_24h_usd) },
          { label: 'Liquidity', value: formatMarketCap(token.liquidity_usd) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0a0a0a] px-3 py-2">
            <div className="text-[#444] text-xs">{label}</div>
            <div className="text-[#ccc] text-sm font-mono mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Score Breakdown</h3>
        {bd ? (
          <>
            <ScoreRow label="🐋 Smart Money" pts={bd.smartMoney.total} max={30} />
            <ScoreRow label="🔒 Token Health" pts={bd.tokenHealth.total} max={25} />
            <ScoreRow label="📈 Momentum" pts={bd.momentum.total} max={25} />
            <ScoreRow label="🕵️ Deployer" pts={bd.deployer.total} max={20} />
            {bd.socialBonus > 0 && (
              <div className="flex items-center justify-between py-2 text-xs">
                <span className="text-[#666]">✨ Social Bonus</span>
                <span className="text-[#888]">+{bd.socialBonus}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-[#444] text-xs">
            Score breakdown not available — click a token from the feed after scoring runs.
          </p>
        )}
      </div>

      <div className="px-4 py-3 mt-auto border-t border-[#1a1a1a] flex flex-col gap-2">
        <a href={`https://dexscreener.com/solana/${token.mint}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#555] hover:text-[#888] transition-colors">View on DexScreener ↗</a>
        <a href={`https://gmgn.ai/sol/token/${token.mint}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#555] hover:text-[#888] transition-colors">Trade on GMGN ↗</a>
      </div>
    </div>
  )
}
