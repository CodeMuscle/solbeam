import type { WalletTransaction } from '@/lib/types'

interface Props {
  transactions: WalletTransaction[]
}

function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

export function TxFeed({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-[#333] text-sm py-4 text-center">
        No tracked wallet transactions for this token
      </div>
    )
  }

  return (
    <div className="divide-y divide-[#0f0f0f]">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5">
          <span
            className={`text-xs font-semibold w-8 ${
              tx.type === 'buy' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {tx.type.toUpperCase()}
          </span>
          <span className="text-[#555] text-xs font-mono flex-1 truncate">
            {tx.wallet_address.slice(0, 6)}…{tx.wallet_address.slice(-4)}
          </span>
          <span className="text-[#666] text-xs">
            {tx.amount_usd ? `$${tx.amount_usd.toFixed(0)}` : '—'}
          </span>
          <span className="text-[#333] text-xs w-16 text-right">
            {timeAgo(tx.timestamp)}
          </span>
        </div>
      ))}
    </div>
  )
}
