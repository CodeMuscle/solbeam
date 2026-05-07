import Image from 'next/image'
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

const SOCIAL_LABELS: Record<string, string> = {
  twitter: '𝕏 Twitter',
  telegram: '✈ Telegram',
  discord: '💬 Discord',
  github: '⌨ GitHub',
  reddit: '👽 Reddit',
}

function socialLabel(type: string): string {
  return SOCIAL_LABELS[type.toLowerCase()] ?? type
}

const EXTERNAL_TOOLS = (mint: string) => [
  { label: '📊 DexScreener', href: `https://dexscreener.com/solana/${mint}` },
  { label: '⚡ GMGN', href: `https://gmgn.ai/sol/token/${mint}` },
  { label: '🦅 Birdeye', href: `https://birdeye.so/token/${mint}?chain=solana` },
  { label: '🫧 Bubblemaps', href: `https://app.bubblemaps.io/sol/token/${mint}` },
  { label: '🔍 Solscan', href: `https://solscan.io/token/${mint}` },
  { label: '🪄 Magic Eden', href: `https://magiceden.io/marketplace/${mint}` },
]

export function TokenDetailPanel({ token, onClose }: Props) {
  const bd = token.score_breakdown
  const bondingPct = token.bonding_curve_pct

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-[#0a0a0a] border-l border-[#1a1a1a] flex flex-col z-40 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {token.image_url && (
            <Image
              src={token.image_url}
              alt={token.symbol ?? ''}
              width={36}
              height={36}
              className="rounded-full bg-[#1a1a1a] flex-shrink-0"
              unoptimized
            />
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold truncate">{token.symbol}</span>
              <SourceBadge source={token.source} />
            </div>
            <span className="text-[#444] text-xs font-mono truncate">{token.mint.slice(0, 16)}…</span>
          </div>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-[#888] text-lg leading-none ml-2 flex-shrink-0">✕</button>
      </div>

      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1a1a1a]">
        <ScorePill score={token.score} />
        <TierBadge tier={token.tier} />
        <span className="text-[#555] text-xs ml-auto">{formatAge(token.created_at)} ago</span>
      </div>

      {bondingPct !== null && bondingPct < 100 && (
        <div className="px-4 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#555] text-xs uppercase tracking-widest">🚀 Bonding Curve</span>
            <span className="text-amber-400 text-xs font-mono tabular-nums">{bondingPct}%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500/60 to-green-500/60 rounded-full"
              style={{ width: `${bondingPct}%` }}
            />
          </div>
          <p className="text-[#333] text-xs mt-1">
            {bondingPct >= 80
              ? '⚠ About to graduate to Raydium'
              : 'Pump.fun bonding curve progress (mcap-derived)'}
          </p>
        </div>
      )}

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

      {(token.socials?.length || token.websites?.length) ? (
        <div className="px-4 py-3 border-b border-[#1a1a1a]">
          <h3 className="text-[#555] text-xs uppercase tracking-widest mb-2">Project Links</h3>
          <div className="flex flex-wrap gap-1.5">
            {token.websites?.map((w) => (
              <a
                key={w.url}
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#ccc] hover:border-[#2a2a2a]"
              >
                🌐 {w.label ?? 'Website'}
              </a>
            ))}
            {token.socials?.map((s) => (
              <a
                key={`${s.type}-${s.url}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#ccc] hover:border-[#2a2a2a]"
              >
                {socialLabel(s.type)}
              </a>
            ))}
          </div>
        </div>
      ) : null}

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
            Score breakdown not available — wait for the next cron tick.
          </p>
        )}
      </div>

      <div className="px-4 py-3 mt-auto border-t border-[#1a1a1a]">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-2">Open in</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {EXTERNAL_TOOLS(token.mint).map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1.5 rounded bg-[#0d0d0d] border border-[#1a1a1a] text-[#666] hover:text-[#ccc] hover:border-[#2a2a2a] text-center"
            >
              {label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
