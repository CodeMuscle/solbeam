import { ScorePill } from './ScorePill'
import { TierBadge } from './TierBadge'
import { SourceBadge } from './SourceBadge'
import { formatMarketCap, formatAge } from '@/lib/feed-utils'
import type { Token } from '@/lib/types'

interface Props {
  token: Token
  isSelected: boolean
  onSelect: (token: Token) => void
}

export function TokenRow({ token, isSelected, onSelect }: Props) {
  return (
    <tr
      onClick={() => onSelect(token)}
      className={`border-b border-[#1a1a1a] cursor-pointer transition-colors ${
        isSelected ? 'bg-[#141414]' : 'hover:bg-[#0f0f0f]'
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm">{token.symbol ?? '—'}</span>
          <span className="text-[#555] text-xs font-mono truncate max-w-[100px]">
            {token.mint.slice(0, 8)}…
          </span>
        </div>
      </td>
      <td className="px-4 py-3"><SourceBadge source={token.source} /></td>
      <td className="px-4 py-3 text-[#666] text-xs tabular-nums">{formatAge(token.created_at)}</td>
      <td className="px-4 py-3 text-[#888] text-sm tabular-nums">{formatMarketCap(token.market_cap_usd)}</td>
      <td className="px-4 py-3"><ScorePill score={token.score} size="sm" /></td>
      <td className="px-4 py-3"><TierBadge tier={token.tier} /></td>
      <td className="px-4 py-3 text-center">
        {token.smart_money_count > 0 ? (
          <span className="text-blue-400 text-sm font-semibold">🐋 {token.smart_money_count}</span>
        ) : (
          <span className="text-[#333] text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (!token.price_usd) return
            const res = await fetch('/api/positions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token_mint: token.mint,
                token_symbol: token.symbol,
                entry_price_usd: token.price_usd,
                entry_score: token.score,
                mode: 'paper',
              }),
            })
            if (res.ok) {
              window.location.href = '/positions'
            }
          }}
          disabled={!token.price_usd}
          className="text-xs px-2.5 py-1 rounded border border-[#2a2a2a] text-[#666] hover:border-green-500/50 hover:text-green-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Paper Buy
        </button>
      </td>
    </tr>
  )
}
