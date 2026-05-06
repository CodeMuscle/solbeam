'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddWalletForm() {
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: address.trim(), label: label.trim() || undefined }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to add wallet')
      return
    }

    setAddress('')
    setLabel('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Solana wallet address"
        className="flex-1 min-w-64 bg-[#111] border border-[#1e1e1e] text-[#ccc] text-sm rounded px-3 py-2 outline-none focus:border-[#2a2a2a] placeholder-[#333] font-mono"
        required
      />
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (optional)"
        className="w-36 bg-[#111] border border-[#1e1e1e] text-[#ccc] text-sm rounded px-3 py-2 outline-none focus:border-[#2a2a2a] placeholder-[#333]"
      />
      <button
        type="submit"
        disabled={loading || address.length < 32}
        className="text-sm px-4 py-2 rounded border border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding…' : 'Add Wallet'}
      </button>
      {error && <span className="text-red-400 text-xs w-full">{error}</span>}
    </form>
  )
}
