import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchTokenPair } from '@/lib/dexscreener'
import { PriceChart } from '@/components/token/PriceChart'
import { ScoreBreakdownPanel } from '@/components/token/ScoreBreakdownPanel'
import { HolderTable } from '@/components/token/HolderTable'
import { TxFeed } from '@/components/token/TxFeed'
import { DeployerHistory } from '@/components/token/DeployerHistory'
import { RiskPanel } from '@/components/token/RiskPanel'
import { CopyButton } from '@/components/token/CopyButton'
import { SourceBadge } from '@/components/feed/SourceBadge'
import { ScorePill } from '@/components/feed/ScorePill'
import type { Token, WalletTransaction } from '@/lib/types'

interface Props {
  params: Promise<{ mint: string }>
}

export const dynamic = 'force-dynamic'

export default async function TokenPage({ params }: Props) {
  const { mint } = await params
  const supabase = await createClient()

  const { data: token } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint', mint)
    .single()

  if (!token) notFound()

  const [, txResult, deployerResult] = await Promise.all([
    fetchTokenPair(mint),
    supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('token_mint', mint)
      .order('timestamp', { ascending: false })
      .limit(20),
    token.deployer_address
      ? supabaseAdmin
          .from('tokens')
          .select('mint, symbol, tier, created_at')
          .eq('deployer_address', token.deployer_address)
          .neq('mint', mint)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ])

  const transactions: WalletTransaction[] = txResult.data ?? []
  const deployerTokens = deployerResult.data ?? []
  const t = token as Token

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-white text-2xl font-bold">{t.symbol}</h1>
          <SourceBadge source={t.source} />
          <ScorePill score={t.score} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#444] text-xs font-mono">{mint}</span>
          <CopyButton text={mint} />
          <a
            href={`https://dexscreener.com/solana/${mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#333] text-xs hover:text-[#555]"
          >
            DexScreener ↗
          </a>
          <a
            href={`https://gmgn.ai/sol/token/${mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#333] text-xs hover:text-[#555]"
          >
            GMGN ↗
          </a>
        </div>
      </div>

      <div className="mb-6">
        <PriceChart candles={[]} symbol={t.symbol ?? mint} />
        <p className="text-[#333] text-xs mt-1 text-center">
          Live OHLCV data integration — connect DexScreener candle endpoint to populate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {t.score_breakdown ? (
          <ScoreBreakdownPanel
            breakdown={t.score_breakdown}
            totalScore={t.score}
          />
        ) : (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 text-[#333] text-sm">
            Score breakdown not yet computed — visit /dashboard and wait for the cron to run.
          </div>
        )}

        <RiskPanel token={t} />
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Top Holders</h3>
        <HolderTable holders={[]} />
        <p className="text-[#222] text-xs mt-2">
          Holder data fetched via Helius DAS API — integrated in deployer enrichment step.
        </p>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Smart Wallet Transactions
        </h3>
        <TxFeed transactions={transactions} />
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Deployer History
        </h3>
        <DeployerHistory
          tokens={deployerTokens as Token[]}
          deployerAddress={t.deployer_address}
        />
      </div>
    </div>
  )
}
