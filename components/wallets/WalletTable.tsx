'use client'

import { useRouter } from 'next/navigation'
import type { TrackedWallet } from '@/lib/types'

interface Props {
  wallets: TrackedWallet[]
}

export function WalletTable({ wallets }: Props) {
  const router = useRouter()

  async function removeWallet(id: string) {
    if (!confirm('Remove this wallet and deregister its webhook?')) return
    await fetch(`/api/wallets/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  if (wallets.length === 0) {
    return (
      <div className="text-[#333] text-sm py-6 text-center">
        No wallets tracked yet. Add one above.
      </div>
    )
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-[#1a1a1a]">
          {['Label', 'Address', 'Win Rate', 'Est. PnL (30d)', ''].map((h) => (
            <th
              key={h}
              className="px-4 py-2.5 text-left text-[#444] font-medium uppercase tracking-wider"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {wallets.map((wallet) => (
          <tr key={wallet.id} className="border-b border-[#0f0f0f] hover:bg-[#0a0a0a]">
            <td className="px-4 py-3 text-[#888]">{wallet.label ?? '—'}</td>
            <td className="px-4 py-3 font-mono text-[#555]">
              {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
            </td>
            <td className="px-4 py-3 text-[#666]">
              {wallet.win_rate != null ? `${(wallet.win_rate * 100).toFixed(0)}%` : '—'}
            </td>
            <td className="px-4 py-3 text-[#666]">
              {wallet.estimated_pnl_usd != null
                ? `$${wallet.estimated_pnl_usd.toFixed(0)}`
                : '—'}
            </td>
            <td className="px-4 py-3">
              <button
                onClick={() => removeWallet(wallet.id)}
                className="text-[#333] hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
