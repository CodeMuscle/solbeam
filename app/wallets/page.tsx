import { supabaseAdmin } from '@/lib/supabase/admin'
import { WalletTable } from '@/components/wallets/WalletTable'
import { WalletTxFeed } from '@/components/wallets/WalletTxFeed'
import { AddWalletForm } from '@/components/wallets/AddWalletForm'
import type { TrackedWallet, WalletTransaction } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function WalletsPage() {
  const [walletsResult, txsResult] = await Promise.all([
    supabaseAdmin
      .from('tracked_wallets')
      .select('*')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50),
  ])

  const wallets: TrackedWallet[] = walletsResult.data ?? []
  const transactions: WalletTransaction[] = txsResult.data ?? []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-semibold text-lg">Smart Wallets</h1>
          <p className="text-[#444] text-xs mt-0.5">
            Track smart money — new transactions appear live via Helius webhooks
          </p>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Add Wallet</h3>
        <AddWalletForm />
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Tracked Wallets ({wallets.length})
        </h3>
        <WalletTable wallets={wallets} />
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Live Transaction Feed
        </h3>
        <WalletTxFeed initialTransactions={transactions} />
      </div>
    </div>
  )
}
