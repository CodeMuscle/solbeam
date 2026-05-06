'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WalletTransaction } from '@/lib/types'

interface Props {
  initialTransactions: WalletTransaction[]
}

function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

export function WalletTxFeed({ initialTransactions }: Props) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>(initialTransactions)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('wallet-tx-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions' },
        (payload) => {
          setTransactions((prev) => [payload.new as WalletTransaction, ...prev.slice(0, 49)])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (transactions.length === 0) {
    return (
      <div className="text-[#333] text-sm py-6 text-center">
        No transactions yet. Transactions appear here in real-time when tracked wallets trade.
      </div>
    )
  }

  return (
    <div className="divide-y divide-[#0f0f0f] max-h-96 overflow-auto">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
          <span
            className={`text-xs font-bold w-8 ${
              tx.type === 'buy' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {tx.type.toUpperCase()}
          </span>
          <span className="text-[#666] text-xs font-mono">
            {tx.wallet_address.slice(0, 6)}…{tx.wallet_address.slice(-4)}
          </span>
          <span className="text-[#888] text-xs font-semibold">
            {tx.token_symbol ?? tx.token_mint?.slice(0, 6) ?? '—'}
          </span>
          <span className="text-[#555] text-xs">
            {tx.amount_usd ? `$${tx.amount_usd.toFixed(0)}` : '—'}
          </span>
          <span className="text-[#333] text-xs ml-auto">{timeAgo(tx.timestamp)}</span>
        </div>
      ))}
    </div>
  )
}
