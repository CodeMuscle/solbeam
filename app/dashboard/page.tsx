import { createClient } from '@/lib/supabase/server'
import { LiveFeed } from '@/components/feed/LiveFeed'
import type { Token } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: tokens, error } = await supabase
    .from('tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Failed to fetch initial tokens:', error)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-white font-semibold text-lg">Live Feed</h1>
          <p className="text-[#444] text-xs mt-0.5">
            Real-time Solana token intelligence · Updates live
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[#555] text-xs">Live</span>
        </div>
      </div>

      <LiveFeed initialTokens={(tokens as Token[]) ?? []} />
    </div>
  )
}
