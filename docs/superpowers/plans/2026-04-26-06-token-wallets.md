# SolBeam — Plan 6: Token Deep-Dive + Wallet Tracker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two informational pages — `/tokens/[mint]` (full token signal breakdown with chart and holder data) and `/wallets` (smart money wallet management with live transaction feed and Helius webhook registration).

**Architecture:** Both pages are Server Components with on-demand data fetching from DexScreener, Helius, and Supabase. The wallets page includes a client-side form for adding wallets that calls the Helius webhook registration API. TradingView Lightweight Charts runs client-side only (it requires the DOM).

**Tech Stack:** TradingView Lightweight Charts (npm), Helius DAS API, DexScreener, Supabase Realtime (wallet tx feed), Next.js 15 App Router.

**Prerequisite:** Plans 1–5 complete. `lib/helius.ts`, `lib/dexscreener.ts`, `lib/types.ts`, `lib/supabase/admin.ts` all exist.

---

## File Map

| File | Responsibility |
|---|---|
| `app/tokens/[mint]/page.tsx` | Token deep-dive Server Component |
| `components/token/PriceChart.tsx` | TradingView Lightweight Charts wrapper (client) |
| `components/token/ScoreBreakdownPanel.tsx` | All 4 score categories with bar charts |
| `components/token/HolderTable.tsx` | Top-10 holder distribution table |
| `components/token/TxFeed.tsx` | Recent on-chain transactions list |
| `components/token/DeployerHistory.tsx` | Previous tokens by same deployer |
| `components/token/RiskPanel.tsx` | Disqualifier flags and signal deductions |
| `app/wallets/page.tsx` | Smart money tracker Server Component |
| `app/api/wallets/route.ts` | GET (list) + POST (add wallet + register webhook) |
| `app/api/wallets/[id]/route.ts` | DELETE (remove wallet + deregister webhook) |
| `components/wallets/WalletTable.tsx` | Tracked wallets table |
| `components/wallets/WalletTxFeed.tsx` | Live cross-wallet transaction feed (Realtime) |
| `components/wallets/AddWalletForm.tsx` | Form to add new wallet address + label |

---

### Task 1: Install TradingView Lightweight Charts

**Files:**
- Modifies: `package.json`

- [ ] **Step 1: Install the charting library**

```bash
npm install lightweight-charts
```

- [ ] **Step 2: Verify installation**

```bash
npm ls lightweight-charts
```

Expected: `lightweight-charts@x.x.x` listed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install lightweight-charts for TradingView price charts"
```

---

### Task 2: Price Chart Component

**Files:**
- Create: `components/token/PriceChart.tsx`

- [ ] **Step 1: Create PriceChart**

Create `/Users/codemuscle/Desktop/solbeam/components/token/PriceChart.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
} from 'lightweight-charts'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

interface Props {
  candles: Candle[]
  symbol: string
}

export function PriceChart({ candles, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#555',
      },
      grid: {
        vertLines: { color: '#111' },
        horzLines: { color: '#111' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1a1a1a' },
      timeScale: { borderColor: '#1a1a1a', timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 280,
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff96',
      downColor: '#ff4444',
      borderUpColor: '#00ff96',
      borderDownColor: '#ff4444',
      wickUpColor: '#00ff96',
      wickDownColor: '#ff4444',
    })

    candleSeries.setData(candles as Parameters<typeof candleSeries.setData>[0])
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [candles])

  if (candles.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
        <span className="text-[#333] text-sm">No chart data available</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#111] text-xs text-[#444] font-mono">
        {symbol} · 1m candles
      </div>
      <div ref={containerRef} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/token/PriceChart.tsx
git commit -m "feat: add TradingView Lightweight Chart component"
```

---

### Task 3: Score Breakdown Panel

**Files:**
- Create: `components/token/ScoreBreakdownPanel.tsx`

- [ ] **Step 1: Create ScoreBreakdownPanel**

Create `/Users/codemuscle/Desktop/solbeam/components/token/ScoreBreakdownPanel.tsx`:

```tsx
import type { ScoreBreakdown } from '@/lib/types'
import { ScorePill } from '@/components/feed/ScorePill'

interface CategoryRowProps {
  label: string
  pts: number
  maxPts: number
  signals: Array<{ name: string; pts: number }>
}

function CategoryRow({ label, pts, maxPts, signals }: CategoryRowProps) {
  const pct = maxPts > 0 ? Math.max(0, (pts / maxPts)) * 100 : 0

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#888] text-sm">{label}</span>
        <span className="text-[#ccc] text-sm font-mono tabular-nums">
          {pts}/{maxPts}
        </span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-green-500/50 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        {signals.map(({ name, pts: sigPts }) => (
          <div key={name} className="flex items-center justify-between text-xs py-0.5">
            <span className="text-[#555]">{name}</span>
            <span className={`tabular-nums ${sigPts >= 0 ? 'text-[#666]' : 'text-red-400'}`}>
              {sigPts >= 0 ? '+' : ''}{sigPts}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  breakdown: ScoreBreakdown
  totalScore: number
}

export function ScoreBreakdownPanel({ breakdown, totalScore }: Props) {
  const { smartMoney: sm, tokenHealth: th, momentum: mo, deployer: de, socialBonus } = breakdown

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#555] text-xs uppercase tracking-widest">Score Breakdown</h3>
        <ScorePill score={totalScore} />
      </div>

      <CategoryRow
        label="🐋 Smart Money"
        pts={sm.total}
        maxPts={30}
        signals={[
          { name: 'Wallet count', pts: sm.walletCount },
          { name: 'Entry recency', pts: sm.recency },
          { name: 'Win rate', pts: sm.winRate },
          { name: 'Cluster penalty', pts: sm.clusterPenalty },
        ]}
      />

      <CategoryRow
        label="🔒 Token Health"
        pts={th.total}
        maxPts={25}
        signals={[
          { name: 'LP locked/burned', pts: th.lpLocked },
          { name: 'Mint renounced', pts: th.mintRenounced },
          { name: 'Freeze disabled', pts: th.freezeDisabled },
          { name: 'Dev wallet %', pts: th.devWalletPct },
          { name: 'Bundle penalty', pts: th.bundlePenalty },
          { name: 'Sniper penalty', pts: th.sniperPenalty },
        ]}
      />

      <CategoryRow
        label="📈 Momentum"
        pts={mo.total}
        maxPts={25}
        signals={[
          { name: 'Vol/MCap ratio', pts: mo.volumeMcapRatio },
          { name: 'Holder growth', pts: mo.holderGrowthRate },
          { name: 'Buy/sell ratio', pts: mo.buySellRatio },
          { name: 'Social links', pts: mo.socialLinks },
          { name: 'Migration bonus', pts: mo.migration },
          { name: 'Wash trade', pts: mo.washTradePenalty },
        ]}
      />

      <CategoryRow
        label="🕵️ Deployer"
        pts={de.total}
        maxPts={20}
        signals={[
          { name: 'Past outcomes', pts: de.previousOutcomes },
          { name: 'Wallet age', pts: de.walletAge },
          { name: 'SOL balance', pts: de.solBalance },
        ]}
      />

      {socialBonus > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#111]">
          <span className="text-[#555] text-xs">✨ Social bonus</span>
          <span className="text-[#666] text-xs">+{socialBonus}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/token/ScoreBreakdownPanel.tsx
git commit -m "feat: add ScoreBreakdownPanel with per-signal breakdown bars"
```

---

### Task 4: Holder Table and Tx Feed

**Files:**
- Create: `components/token/HolderTable.tsx`
- Create: `components/token/TxFeed.tsx`
- Create: `components/token/DeployerHistory.tsx`
- Create: `components/token/RiskPanel.tsx`

- [ ] **Step 1: Create HolderTable**

Create `/Users/codemuscle/Desktop/solbeam/components/token/HolderTable.tsx`:

```tsx
interface Holder {
  address: string
  pct: number
  walletAge?: number
  label?: string
}

interface Props {
  holders: Holder[]
}

export function HolderTable({ holders }: Props) {
  if (holders.length === 0) {
    return (
      <div className="text-[#333] text-sm py-4 text-center">
        Holder data not available
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            {['#', 'Address', 'Hold %', 'Label'].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-[#444] font-medium uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holders.map((holder, i) => (
            <tr key={holder.address} className="border-b border-[#0f0f0f]">
              <td className="px-3 py-2 text-[#444]">{i + 1}</td>
              <td className="px-3 py-2 font-mono text-[#666]">
                {holder.address.slice(0, 6)}…{holder.address.slice(-4)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                <span
                  className={`${
                    holder.pct > 20 ? 'text-red-400' : holder.pct > 10 ? 'text-amber-400' : 'text-[#666]'
                  }`}
                >
                  {holder.pct.toFixed(2)}%
                </span>
              </td>
              <td className="px-3 py-2 text-[#444]">
                {holder.label ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create TxFeed**

Create `/Users/codemuscle/Desktop/solbeam/components/token/TxFeed.tsx`:

```tsx
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
```

- [ ] **Step 3: Create DeployerHistory**

Create `/Users/codemuscle/Desktop/solbeam/components/token/DeployerHistory.tsx`:

```tsx
import type { Token } from '@/lib/types'
import { TierBadge } from '@/components/feed/TierBadge'

interface Props {
  tokens: Pick<Token, 'mint' | 'symbol' | 'tier' | 'created_at'>[]
  deployerAddress: string | null
}

export function DeployerHistory({ tokens, deployerAddress }: Props) {
  if (!deployerAddress) {
    return (
      <div className="text-[#333] text-sm py-4 text-center">Deployer address unknown</div>
    )
  }

  return (
    <div>
      <p className="text-[#444] text-xs font-mono mb-3 truncate">{deployerAddress}</p>
      {tokens.length === 0 ? (
        <p className="text-[#333] text-sm">No previous tokens found for this deployer.</p>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div key={token.mint} className="flex items-center gap-3">
              <span className="text-[#666] text-xs font-semibold w-16 truncate">
                {token.symbol ?? token.mint.slice(0, 6)}
              </span>
              <TierBadge tier={token.tier} />
              <span className="text-[#333] text-xs ml-auto">
                {new Date(token.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create RiskPanel**

Create `/Users/codemuscle/Desktop/solbeam/components/token/RiskPanel.tsx`:

```tsx
import type { Token, ScoreBreakdown } from '@/lib/types'

interface Props {
  token: Token
}

function RiskItem({ label, isRisk }: { label: string; isRisk: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      <span className={isRisk ? 'text-red-400' : 'text-green-400'}>
        {isRisk ? '⛔' : '✅'}
      </span>
      <span className={isRisk ? 'text-[#888]' : 'text-[#555]'}>{label}</span>
    </div>
  )
}

export function RiskPanel({ token }: Props) {
  const bd = token.score_breakdown as ScoreBreakdown | null

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Risk Assessment</h3>

      {token.disqualified && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
          ⛔ Disqualified: {token.disqualify_reason}
        </div>
      )}

      <RiskItem label="Mint authority renounced" isRisk={!token.mint_renounced} />
      <RiskItem label="Freeze authority disabled" isRisk={!token.freeze_disabled} />
      <RiskItem label="LP locked or burned" isRisk={!token.lp_locked} />
      <RiskItem
        label={`Dev wallet: ${token.dev_wallet_pct?.toFixed(1) ?? '?'}% of supply`}
        isRisk={(token.dev_wallet_pct ?? 0) > 5}
      />

      {bd && bd.tokenHealth.bundlePenalty < 0 && (
        <RiskItem label="Bundled launch detected" isRisk={true} />
      )}
      {bd && bd.tokenHealth.sniperPenalty < -3 && (
        <RiskItem label="Sniper wallets present" isRisk={true} />
      )}
      {bd && bd.momentum.washTradePenalty < 0 && (
        <RiskItem label="Wash trading detected" isRisk={true} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/token/HolderTable.tsx components/token/TxFeed.tsx components/token/DeployerHistory.tsx components/token/RiskPanel.tsx
git commit -m "feat: add HolderTable, TxFeed, DeployerHistory, RiskPanel components"
```

---

### Task 5: Token Deep-Dive Page

**Files:**
- Modify: `app/tokens/[mint]/page.tsx`

- [ ] **Step 1: Implement the token deep-dive page**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/tokens/[mint]/page.tsx`:

```tsx
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

  // Fetch token from DB
  const { data: token } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint', mint)
    .single()

  if (!token) notFound()

  // Fetch in parallel: pair data, recent wallet txs, deployer history
  const [pair, txResult, deployerResult] = await Promise.all([
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-white text-2xl font-bold">{(token as Token).symbol}</h1>
          <SourceBadge source={(token as Token).source} />
          <ScorePill score={(token as Token).score} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#444] text-xs font-mono">{mint}</span>
          <button
            onClick={() => navigator.clipboard.writeText(mint)}
            className="text-[#333] text-xs hover:text-[#666]"
          >
            Copy
          </button>
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

      {/* Chart */}
      <div className="mb-6">
        <PriceChart candles={[]} symbol={(token as Token).symbol ?? mint} />
        <p className="text-[#333] text-xs mt-1 text-center">
          Live OHLCV data integration — connect DexScreener candle endpoint to populate.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Score breakdown */}
        {(token as Token).score_breakdown ? (
          <ScoreBreakdownPanel
            breakdown={(token as Token).score_breakdown!}
            totalScore={(token as Token).score}
          />
        ) : (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 text-[#333] text-sm">
            Score breakdown not yet computed — visit /dashboard and wait for the cron to run.
          </div>
        )}

        {/* Risk panel */}
        <RiskPanel token={token as Token} />
      </div>

      {/* Holders */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Top Holders</h3>
        <HolderTable holders={[]} />
        <p className="text-[#222] text-xs mt-2">
          Holder data fetched via Helius DAS API — integrated in deployer enrichment step.
        </p>
      </div>

      {/* Recent transactions */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Smart Wallet Transactions
        </h3>
        <TxFeed transactions={transactions} />
      </div>

      {/* Deployer history */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Deployer History
        </h3>
        <DeployerHistory
          tokens={deployerTokens as Token[]}
          deployerAddress={(token as Token).deployer_address}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify the token page loads**

```bash
npm run dev
```

Open `http://localhost:3000/tokens/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` (using the BONK mint seeded in Plan 4).

You should see:
- The BONK symbol header with source badge and score pill
- The chart placeholder
- Score breakdown panel (or "not yet computed" message)
- Risk panel
- Empty holders and tx sections

Press `Ctrl+C`.

- [ ] **Step 4: Commit**

```bash
git add app/tokens/\[mint\]/page.tsx
git commit -m "feat: implement token deep-dive page with chart, score breakdown, risk panel"
```

---

### Task 6: Wallet API Routes

**Files:**
- Create: `app/api/wallets/route.ts`
- Create: `app/api/wallets/[id]/route.ts`

- [ ] **Step 1: Create wallets GET + POST**

Create `/Users/codemuscle/Desktop/solbeam/app/api/wallets/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { registerWebhook } from '@/lib/helius'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('tracked_wallets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { address: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.address || body.address.length < 32) {
    return NextResponse.json(
      { error: 'Valid Solana wallet address required' },
      { status: 400 }
    )
  }

  // Register Helius webhook for this wallet
  const webhookId = await registerWebhook([body.address])

  const { data, error } = await supabaseAdmin
    .from('tracked_wallets')
    .insert({
      address: body.address,
      label: body.label ?? null,
      helius_webhook_id: webhookId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create wallet DELETE handler**

Create `/Users/codemuscle/Desktop/solbeam/app/api/wallets/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteWebhook } from '@/lib/helius'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params

  // Fetch webhook ID before deleting
  const { data: wallet } = await supabaseAdmin
    .from('tracked_wallets')
    .select('helius_webhook_id')
    .eq('id', id)
    .single()

  if (wallet?.helius_webhook_id) {
    await deleteWebhook(wallet.helius_webhook_id)
  }

  const { error } = await supabaseAdmin
    .from('tracked_wallets')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/wallets/route.ts app/api/wallets/\[id\]/route.ts
git commit -m "feat: add wallet CRUD API with Helius webhook registration"
```

---

### Task 7: Wallet Tracker UI

**Files:**
- Create: `components/wallets/AddWalletForm.tsx`
- Create: `components/wallets/WalletTable.tsx`
- Create: `components/wallets/WalletTxFeed.tsx`
- Modify: `app/wallets/page.tsx`

- [ ] **Step 1: Create AddWalletForm**

Create `/Users/codemuscle/Desktop/solbeam/components/wallets/AddWalletForm.tsx`:

```tsx
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
```

- [ ] **Step 2: Create WalletTable**

Create `/Users/codemuscle/Desktop/solbeam/components/wallets/WalletTable.tsx`:

```tsx
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
```

- [ ] **Step 3: Create WalletTxFeed**

Create `/Users/codemuscle/Desktop/solbeam/components/wallets/WalletTxFeed.tsx`:

```tsx
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
```

- [ ] **Step 4: Implement the wallets page**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/wallets/page.tsx`:

```tsx
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

      {/* Add wallet form */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">Add Wallet</h3>
        <AddWalletForm />
      </div>

      {/* Wallet table */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-6">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Tracked Wallets ({wallets.length})
        </h3>
        <WalletTable wallets={wallets} />
      </div>

      {/* Live tx feed */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        <h3 className="text-[#555] text-xs uppercase tracking-widest mb-3">
          Live Transaction Feed
        </h3>
        <WalletTxFeed initialTransactions={transactions} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Enable Realtime on wallet_transactions**

In Supabase SQL Editor, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;
```

- [ ] **Step 6: Verify the wallets page renders**

```bash
npm run dev
```

Open `http://localhost:3000/wallets`. You should see:
- Add wallet form with address input
- Empty wallet table
- Empty tx feed

Press `Ctrl+C`.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all 81 tests still pass (no new tests in this plan — logic was already covered by helius tests).

- [ ] **Step 8: Build verification**

```bash
npx tsc --noEmit && npm run build
```

Expected: clean.

- [ ] **Step 9: Commit everything**

```bash
git add -A
git commit -m "feat: implement wallets page with live tx feed, add/remove wallet, Helius webhook management"
```

---

## Plan 6 Complete

At this point you have:
- Token deep-dive page with score breakdown, risk panel, tx feed, deployer history
- TradingView chart component (ready for candle data)
- Wallets page with real-time tx feed via Supabase Realtime
- Wallet add/remove with Helius webhook registration and deregistration
- 81 passing tests, clean build

**Next:** Plan 7 — Backtester + Settings (`/backtester` with forward test report + `/settings` with weight tuning).
