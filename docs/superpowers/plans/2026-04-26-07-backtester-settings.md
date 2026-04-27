# SolBeam — Plan 7: Backtester + Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/backtester` page (Forward Test tab showing paper trade performance + Historical Replay tab) and the `/settings` page (signal weight sliders, alert thresholds, keyword editor, Telegram config). Together these complete the full SolBeam feature set.

**Architecture:** Both pages are Server Components wrapping Client Components for interactive controls. Backtester reads from `positions` (closed paper trades) and `score_history`. Settings reads/writes the single `settings` row via a PATCH API route. Weight sliders enforce a sum-to-100 constraint client-side.

**Tech Stack:** Next.js 15, Supabase, React hooks, Tailwind CSS.

**Prerequisite:** Plans 1–6 complete. `settings` table exists with default row. `positions` table exists.

---

## File Map

| File | Responsibility |
|---|---|
| `app/backtester/page.tsx` | Server Component — fetches closed positions and score history |
| `components/backtester/ForwardTestReport.tsx` | Paper trade performance stats by score bucket |
| `components/backtester/HistoricalReplayTab.tsx` | Historical replay placeholder (shows state) |
| `lib/backtester-stats.ts` | Pure functions — compute win rate, avg return by bucket |
| `app/settings/page.tsx` | Server Component — fetches current settings |
| `app/api/settings/route.ts` | GET + PATCH settings row |
| `components/settings/WeightSliders.tsx` | Signal weight sliders (must sum to 100) |
| `components/settings/KeywordEditor.tsx` | Editable list of narrative keywords |
| `components/settings/TelegramConfig.tsx` | Bot token + chat ID fields |
| `components/settings/SettingsForm.tsx` | Wraps all settings sections, handles PATCH |
| `__tests__/lib/backtester-stats.test.ts` | Unit tests for stat computation functions |

---

### Task 1: Backtester Stats (TDD)

**Files:**
- Create: `lib/backtester-stats.ts`
- Create: `__tests__/lib/backtester-stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/backtester-stats.test.ts`:

```typescript
import {
  computeForwardTestStats,
  groupByScoreBucket,
  type ClosedPosition,
  type ScoreBucketStats,
} from '@/lib/backtester-stats'

function makePosition(overrides: Partial<ClosedPosition> = {}): ClosedPosition {
  return {
    id: 'pos1',
    entry_score: 75,
    pnl_pct: 150,
    outcome_tier: 'RUNNER',
    entry_timestamp: new Date().toISOString(),
    exit_timestamp: new Date().toISOString(),
    mode: 'paper',
    ...overrides,
  }
}

describe('groupByScoreBucket', () => {
  it('groups positions into correct 10-point buckets', () => {
    const positions = [
      makePosition({ entry_score: 65 }),
      makePosition({ entry_score: 72 }),
      makePosition({ entry_score: 85 }),
      makePosition({ entry_score: 92 }),
    ]
    const groups = groupByScoreBucket(positions)
    expect(groups['60-70']).toHaveLength(1)
    expect(groups['70-80']).toHaveLength(1)
    expect(groups['80-90']).toHaveLength(1)
    expect(groups['90-100']).toHaveLength(1)
  })

  it('ignores positions with null entry_score', () => {
    const positions = [makePosition({ entry_score: null as unknown as number })]
    const groups = groupByScoreBucket(positions)
    const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0)
    expect(total).toBe(0)
  })
})

describe('computeForwardTestStats', () => {
  it('returns empty array for no positions', () => {
    const stats = computeForwardTestStats([])
    expect(stats).toEqual([])
  })

  it('computes correct win rate for a bucket', () => {
    const positions = [
      makePosition({ entry_score: 75, pnl_pct: 200, outcome_tier: 'RUNNER' }),
      makePosition({ entry_score: 78, pnl_pct: -15, outcome_tier: 'FLAT' }),
      makePosition({ entry_score: 71, pnl_pct: 80, outcome_tier: 'MODERATE_PUMP' }),
    ]
    const stats = computeForwardTestStats(positions)
    const bucket = stats.find((s) => s.bucket === '70-80')!
    expect(bucket.count).toBe(3)
    expect(bucket.winRate).toBeCloseTo(2 / 3)
    expect(bucket.avgReturnPct).toBeCloseTo((200 + -15 + 80) / 3)
  })

  it('marks a trade as a win when pnl_pct > 0', () => {
    const positions = [makePosition({ entry_score: 85, pnl_pct: 1 })]
    const stats = computeForwardTestStats(positions)
    expect(stats[0].winRate).toBe(1)
  })

  it('marks a trade as a loss when pnl_pct <= 0', () => {
    const positions = [makePosition({ entry_score: 85, pnl_pct: 0 })]
    const stats = computeForwardTestStats(positions)
    expect(stats[0].winRate).toBe(0)
  })

  it('returns buckets sorted from highest score to lowest', () => {
    const positions = [
      makePosition({ entry_score: 65, pnl_pct: 10 }),
      makePosition({ entry_score: 92, pnl_pct: 500 }),
    ]
    const stats = computeForwardTestStats(positions)
    expect(stats[0].bucket).toBe('90-100')
    expect(stats[1].bucket).toBe('60-70')
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/backtester-stats.test.ts
```

Expected: `Cannot find module '@/lib/backtester-stats'`

- [ ] **Step 3: Implement lib/backtester-stats.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/backtester-stats.ts`:

```typescript
import type { OutcomeTier } from './types'

export interface ClosedPosition {
  id: string
  entry_score: number
  pnl_pct: number | null
  outcome_tier: OutcomeTier | null
  entry_timestamp: string
  exit_timestamp: string | null
  mode: 'paper' | 'real'
}

export interface ScoreBucketStats {
  bucket: string
  count: number
  winRate: number
  avgReturnPct: number
  bestTrade: number
  worstTrade: number
}

type BucketKey = '60-70' | '70-80' | '80-90' | '90-100' | '<60'

function getBucket(score: number): BucketKey {
  if (score >= 90) return '90-100'
  if (score >= 80) return '80-90'
  if (score >= 70) return '70-80'
  if (score >= 60) return '60-70'
  return '<60'
}

const BUCKET_ORDER: BucketKey[] = ['90-100', '80-90', '70-80', '60-70', '<60']

export function groupByScoreBucket(
  positions: ClosedPosition[]
): Partial<Record<BucketKey, ClosedPosition[]>> {
  const groups: Partial<Record<BucketKey, ClosedPosition[]>> = {}

  for (const pos of positions) {
    if (pos.entry_score == null) continue
    const bucket = getBucket(pos.entry_score)
    if (!groups[bucket]) groups[bucket] = []
    groups[bucket]!.push(pos)
  }

  return groups
}

export function computeForwardTestStats(positions: ClosedPosition[]): ScoreBucketStats[] {
  if (positions.length === 0) return []

  const groups = groupByScoreBucket(positions)
  const stats: ScoreBucketStats[] = []

  for (const bucket of BUCKET_ORDER) {
    const bucketPositions = groups[bucket]
    if (!bucketPositions || bucketPositions.length === 0) continue

    const pnls = bucketPositions.map((p) => p.pnl_pct ?? 0)
    const wins = pnls.filter((p) => p > 0).length

    stats.push({
      bucket,
      count: bucketPositions.length,
      winRate: wins / bucketPositions.length,
      avgReturnPct: pnls.reduce((s, p) => s + p, 0) / pnls.length,
      bestTrade: Math.max(...pnls),
      worstTrade: Math.min(...pnls),
    })
  }

  return stats
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npm test __tests__/lib/backtester-stats.test.ts
```

Expected:
```
PASS __tests__/lib/backtester-stats.test.ts
  groupByScoreBucket
    ✓ groups positions into correct 10-point buckets
    ✓ ignores positions with null entry_score
  computeForwardTestStats
    ✓ returns empty array for no positions
    ✓ computes correct win rate for a bucket
    ✓ marks a trade as a win when pnl_pct > 0
    ✓ marks a trade as a loss when pnl_pct <= 0
    ✓ returns buckets sorted from highest score to lowest

Tests: 7 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/backtester-stats.ts __tests__/lib/backtester-stats.test.ts
git commit -m "feat: add backtester stats functions with 7 tests"
```

---

### Task 2: Forward Test Report Component

**Files:**
- Create: `components/backtester/ForwardTestReport.tsx`

- [ ] **Step 1: Create ForwardTestReport**

Create `/Users/codemuscle/Desktop/solbeam/components/backtester/ForwardTestReport.tsx`:

```tsx
import type { ScoreBucketStats } from '@/lib/backtester-stats'

interface Props {
  stats: ScoreBucketStats[]
  totalTrades: number
}

function WinRateBar({ rate }: { rate: number }) {
  const pct = rate * 100
  const color = pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-right text-[#888]">{pct.toFixed(0)}%</span>
    </div>
  )
}

export function ForwardTestReport({ stats, totalTrades }: Props) {
  if (totalTrades === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#333] text-sm">No closed paper trades yet.</p>
        <p className="text-[#222] text-xs mt-2">
          Open paper trades from the Live Feed and close them to build your performance report.
        </p>
      </div>
    )
  }

  const overallWins = stats.reduce((s, b) => s + Math.round(b.winRate * b.count), 0)
  const overallWinRate = totalTrades > 0 ? overallWins / totalTrades : 0
  const avgReturn = stats.length > 0
    ? stats.reduce((s, b) => s + b.avgReturnPct * b.count, 0) / totalTrades
    : 0

  // Recommend minimum score based on data
  const recommendedMin = stats.find((s) => s.winRate >= 0.6)?.bucket ?? 'Need more data'

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Trades', value: totalTrades.toString() },
          { label: 'Overall Win Rate', value: `${(overallWinRate * 100).toFixed(0)}%` },
          { label: 'Avg Return', value: `${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg p-4 text-center">
            <div className="text-[#444] text-xs mb-1">{label}</div>
            <div className="text-white text-xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Recommended threshold */}
      <div className="mb-6 px-4 py-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-xs">
        <span className="text-[#444]">Recommended min score threshold: </span>
        <span className="text-green-400 font-semibold">{recommendedMin}</span>
        <span className="text-[#333] ml-2">(first bucket with win rate ≥ 60%)</span>
      </div>

      {/* Score bucket table */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            {['Score Range', 'Trades', 'Win Rate', 'Avg Return', 'Best', 'Worst'].map((h) => (
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
          {stats.map((row) => (
            <tr key={row.bucket} className="border-b border-[#0f0f0f]">
              <td className="px-4 py-3 font-mono text-[#888]">{row.bucket}</td>
              <td className="px-4 py-3 text-[#666] tabular-nums">{row.count}</td>
              <td className="px-4 py-3 w-40">
                <WinRateBar rate={row.winRate} />
              </td>
              <td className="px-4 py-3 tabular-nums">
                <span className={row.avgReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {row.avgReturnPct >= 0 ? '+' : ''}{row.avgReturnPct.toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-3 text-green-400 tabular-nums">+{row.bestTrade.toFixed(1)}%</td>
              <td className="px-4 py-3 text-red-400 tabular-nums">{row.worstTrade.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create HistoricalReplayTab placeholder**

Create `/Users/codemuscle/Desktop/solbeam/components/backtester/HistoricalReplayTab.tsx`:

```tsx
export function HistoricalReplayTab() {
  return (
    <div className="text-center py-16">
      <p className="text-[#333] text-sm mb-2">Historical Replay</p>
      <p className="text-[#222] text-xs max-w-sm mx-auto">
        Replay will be enabled once SolBeam has collected 7+ days of token launch data in the{' '}
        <code className="font-mono text-[#333]">score_history</code> table.
        Until then, use the Forward Test tab to calibrate your signal thresholds.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/backtester/ForwardTestReport.tsx components/backtester/HistoricalReplayTab.tsx
git commit -m "feat: add ForwardTestReport and HistoricalReplayTab components"
```

---

### Task 3: Backtester Page

**Files:**
- Modify: `app/backtester/page.tsx`

- [ ] **Step 1: Implement the backtester page**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/backtester/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ForwardTestReport } from '@/components/backtester/ForwardTestReport'
import { HistoricalReplayTab } from '@/components/backtester/HistoricalReplayTab'
import { computeForwardTestStats } from '@/lib/backtester-stats'
import type { ClosedPosition, ScoreBucketStats } from '@/lib/backtester-stats'

export default function BacktesterPage() {
  const [tab, setTab] = useState<'forward' | 'historical'>('forward')
  const [positions, setPositions] = useState<ClosedPosition[]>([])
  const [stats, setStats] = useState<ScoreBucketStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/positions/closed')
      if (res.ok) {
        const data: ClosedPosition[] = await res.json()
        setPositions(data)
        setStats(computeForwardTestStats(data))
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-white font-semibold text-lg">Backtester</h1>
        <p className="text-[#444] text-xs mt-0.5">
          Calibrate your signal thresholds against real paper trade outcomes
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-6">
        {(['forward', 'historical'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-4 py-2 rounded transition-colors capitalize ${
              tab === t
                ? 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {t === 'forward' ? 'Forward Test' : 'Historical Replay'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
        {loading ? (
          <div className="text-center py-8 text-[#333] text-sm">Loading…</div>
        ) : tab === 'forward' ? (
          <ForwardTestReport stats={stats} totalTrades={positions.length} />
        ) : (
          <HistoricalReplayTab />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the closed positions endpoint**

Create `/Users/codemuscle/Desktop/solbeam/app/api/positions/closed/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('id, entry_score, pnl_pct, outcome_tier, entry_timestamp, exit_timestamp, mode')
    .eq('status', 'closed')
    .eq('mode', 'paper')
    .order('exit_timestamp', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/backtester/page.tsx app/api/positions/closed/route.ts
git commit -m "feat: implement backtester page with forward test report and closed positions API"
```

---

### Task 4: Settings API Route

**Files:**
- Create: `app/api/settings/route.ts`

- [ ] **Step 1: Create the settings API**

Create `/Users/codemuscle/Desktop/solbeam/app/api/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Settings } from '@/lib/types'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: Partial<Omit<Settings, 'id'>>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate signal weights sum to 100
  if (body.signal_weights) {
    const { smart_money, token_health, momentum, deployer } = body.signal_weights
    const total = smart_money + token_health + momentum + deployer
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Signal weights must sum to 100 (current sum: ${total})` },
        { status: 400 }
      )
    }
  }

  // Reject id field if accidentally included
  delete (body as Record<string, unknown>).id

  const { data, error } = await supabaseAdmin
    .from('settings')
    .update(body)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/settings/route.ts
git commit -m "feat: add settings API with weight validation (must sum to 100)"
```

---

### Task 5: Settings UI Components

**Files:**
- Create: `components/settings/WeightSliders.tsx`
- Create: `components/settings/KeywordEditor.tsx`
- Create: `components/settings/TelegramConfig.tsx`

- [ ] **Step 1: Create WeightSliders**

Create `/Users/codemuscle/Desktop/solbeam/components/settings/WeightSliders.tsx`:

```tsx
import type { SignalWeights } from '@/lib/types'

interface Props {
  weights: SignalWeights
  onChange: (weights: SignalWeights) => void
}

const categories: Array<{ key: keyof SignalWeights; label: string; color: string }> = [
  { key: 'smart_money', label: '🐋 Smart Money', color: 'accent-blue-400' },
  { key: 'token_health', label: '🔒 Token Health', color: 'accent-green-400' },
  { key: 'momentum', label: '📈 Momentum', color: 'accent-amber-400' },
  { key: 'deployer', label: '🕵️ Deployer', color: 'accent-purple-400' },
]

export function WeightSliders({ weights, onChange }: Props) {
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  const isValid = Math.abs(total - 100) < 0.01

  function handleChange(key: keyof SignalWeights, value: number) {
    onChange({ ...weights, [key]: value })
  }

  return (
    <div>
      {categories.map(({ key, label, color }) => (
        <div key={key} className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#888] text-sm">{label}</span>
            <span className="text-[#ccc] text-sm tabular-nums font-mono w-8 text-right">
              {weights[key]}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={weights[key]}
            onChange={(e) => handleChange(key, Number(e.target.value))}
            className={`w-full ${color}`}
          />
        </div>
      ))}

      <div
        className={`flex items-center justify-between text-xs mt-4 pt-3 border-t border-[#1a1a1a] ${
          isValid ? 'text-[#444]' : 'text-red-400'
        }`}
      >
        <span>Total</span>
        <span className="font-mono tabular-nums">
          {total} / 100 {isValid ? '✓' : '⚠ Must equal 100'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create KeywordEditor**

Create `/Users/codemuscle/Desktop/solbeam/components/settings/KeywordEditor.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface Props {
  keywords: string[]
  onChange: (keywords: string[]) => void
}

export function KeywordEditor({ keywords, onChange }: Props) {
  const [input, setInput] = useState('')

  function addKeyword() {
    const kw = input.trim().toUpperCase()
    if (!kw || keywords.includes(kw)) return
    onChange([...keywords, kw])
    setInput('')
  }

  function removeKeyword(kw: string) {
    onChange(keywords.filter((k) => k !== kw))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-[#111] border border-[#1e1e1e] rounded text-[#888]"
          >
            {kw}
            <button
              onClick={() => removeKeyword(kw)}
              className="text-[#444] hover:text-red-400 ml-1"
            >
              ✕
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-[#333] text-xs">No keywords yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          placeholder="Add keyword (e.g. AI)"
          className="flex-1 bg-[#111] border border-[#1e1e1e] text-[#ccc] text-xs rounded px-3 py-1.5 outline-none focus:border-[#2a2a2a] placeholder-[#333]"
        />
        <button
          onClick={addKeyword}
          className="text-xs px-3 py-1.5 rounded border border-[#2a2a2a] text-[#666] hover:text-[#aaa] transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create TelegramConfig**

Create `/Users/codemuscle/Desktop/solbeam/components/settings/TelegramConfig.tsx`:

```tsx
interface Props {
  botToken: string
  chatId: string
  onChangeBotToken: (value: string) => void
  onChangeChatId: (value: string) => void
}

export function TelegramConfig({ botToken, chatId, onChangeBotToken, onChangeChatId }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[#555] text-xs mb-1">Bot Token</label>
        <input
          type="password"
          value={botToken}
          onChange={(e) => onChangeBotToken(e.target.value)}
          placeholder="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-xs rounded px-3 py-2 outline-none focus:border-[#2a2a2a] placeholder-[#333] font-mono"
        />
      </div>
      <div>
        <label className="block text-[#555] text-xs mb-1">Chat ID</label>
        <input
          type="text"
          value={chatId}
          onChange={(e) => onChangeChatId(e.target.value)}
          placeholder="-100123456789 or @channelname"
          className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-xs rounded px-3 py-2 outline-none focus:border-[#2a2a2a] placeholder-[#333] font-mono"
        />
      </div>
      <p className="text-[#333] text-xs">
        Create a bot via @BotFather → get token. Message the bot, then call
        api.telegram.org/bot&lt;token&gt;/getUpdates to find your chat ID.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/settings/WeightSliders.tsx components/settings/KeywordEditor.tsx components/settings/TelegramConfig.tsx
git commit -m "feat: add WeightSliders, KeywordEditor, TelegramConfig setting components"
```

---

### Task 6: SettingsForm Client Component

**Files:**
- Create: `components/settings/SettingsForm.tsx`

- [ ] **Step 1: Create SettingsForm**

Create `/Users/codemuscle/Desktop/solbeam/components/settings/SettingsForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { WeightSliders } from './WeightSliders'
import { KeywordEditor } from './KeywordEditor'
import { TelegramConfig } from './TelegramConfig'
import type { Settings } from '@/lib/types'

interface Props {
  initialSettings: Settings
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-4">
      <h3 className="text-[#555] text-xs uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function SettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weightTotal = Object.values(settings.signal_weights).reduce((s, v) => s + v, 0)
  const weightsValid = Math.abs(weightTotal - 100) < 0.01

  async function handleSave() {
    if (!weightsValid) return
    setSaving(true)
    setError(null)

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal_weights: settings.signal_weights,
        social_signal_enabled: settings.social_signal_enabled,
        narrative_keywords: settings.narrative_keywords,
        min_alert_score: settings.min_alert_score,
        take_profit_tiers: settings.take_profit_tiers,
        stop_loss_pct: settings.stop_loss_pct,
        break_even_fee_pct: settings.break_even_fee_pct,
        telegram_bot_token: settings.telegram_bot_token,
        telegram_chat_id: settings.telegram_chat_id,
        data_retention_days: settings.data_retention_days,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      {/* Signal weights */}
      <Section title="Signal Weights">
        <WeightSliders
          weights={settings.signal_weights}
          onChange={(w) => setSettings((s) => ({ ...s, signal_weights: w }))}
        />
      </Section>

      {/* Social/narrative signal */}
      <Section title="Social & Narrative Signal">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[#888] text-sm flex-1">Enable social bonus (+0–5 pts)</span>
          <button
            onClick={() =>
              setSettings((s) => ({ ...s, social_signal_enabled: !s.social_signal_enabled }))
            }
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.social_signal_enabled ? 'bg-green-500/40' : 'bg-[#1a1a1a]'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform bg-white ${
                settings.social_signal_enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <KeywordEditor
          keywords={settings.narrative_keywords}
          onChange={(kw) => setSettings((s) => ({ ...s, narrative_keywords: kw }))}
        />
      </Section>

      {/* Thresholds */}
      <Section title="Alert Thresholds">
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: 'Min alert score',
              key: 'min_alert_score' as const,
              min: 0,
              max: 100,
              step: 5,
            },
            {
              label: 'Stop-loss %',
              key: 'stop_loss_pct' as const,
              min: 0,
              max: 90,
              step: 5,
            },
            {
              label: 'Break-even fee %',
              key: 'break_even_fee_pct' as const,
              min: 0,
              max: 2,
              step: 0.1,
            },
            {
              label: 'Data retention (days)',
              key: 'data_retention_days' as const,
              min: 7,
              max: 90,
              step: 7,
            },
          ].map(({ label, key, min, max, step }) => (
            <div key={key}>
              <label className="block text-[#555] text-xs mb-1">{label}</label>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={settings[key] as number}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))
                }
                className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-sm rounded px-3 py-2 outline-none focus:border-[#2a2a2a] tabular-nums"
              />
            </div>
          ))}
        </div>
        {/* Take-profit tiers */}
        <div className="mt-4">
          <label className="block text-[#555] text-xs mb-1">
            Take-profit tiers (comma-separated multipliers)
          </label>
          <input
            type="text"
            value={settings.take_profit_tiers.join(', ')}
            onChange={(e) => {
              const parsed = e.target.value
                .split(',')
                .map((s) => parseFloat(s.trim()))
                .filter((n) => !isNaN(n))
              setSettings((s) => ({ ...s, take_profit_tiers: parsed }))
            }}
            placeholder="1.5, 3.0, 10.0"
            className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-sm rounded px-3 py-2 outline-none focus:border-[#2a2a2a] font-mono"
          />
          <p className="text-[#333] text-xs mt-1">
            Default: 1.5 (moderate), 3.0 (runner), 10.0 (moonshot)
          </p>
        </div>
      </Section>

      {/* Telegram */}
      <Section title="Telegram Alerts">
        <TelegramConfig
          botToken={settings.telegram_bot_token ?? ''}
          chatId={settings.telegram_chat_id ?? ''}
          onChangeBotToken={(v) => setSettings((s) => ({ ...s, telegram_bot_token: v || null }))}
          onChangeChatId={(v) => setSettings((s) => ({ ...s, telegram_chat_id: v || null }))}
        />
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !weightsValid}
          className="text-sm px-5 py-2 rounded border border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-400 text-xs">✓ Saved</span>}
        {error && <span className="text-red-400 text-xs">{error}</span>}
        {!weightsValid && (
          <span className="text-amber-400 text-xs">
            Signal weights must sum to 100 (currently {weightTotal})
          </span>
        )}
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

- [ ] **Step 3: Commit**

```bash
git add components/settings/SettingsForm.tsx
git commit -m "feat: add SettingsForm with all sections and save flow"
```

---

### Task 7: Settings Page

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Implement the settings page**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/settings/page.tsx`:

```tsx
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SettingsForm } from '@/components/settings/SettingsForm'
import type { Settings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  signal_weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
  social_signal_enabled: true,
  narrative_keywords: ['AI', 'TRUMP', 'DOG', 'PEPE', 'RWA', 'MEME', 'CAT'],
  min_alert_score: 70,
  take_profit_tiers: [1.5, 3.0, 10.0],
  stop_loss_pct: 30,
  break_even_fee_pct: 0.5,
  telegram_bot_token: null,
  telegram_chat_id: null,
  data_retention_days: 30,
}

export default async function SettingsPage() {
  const { data } = await supabaseAdmin.from('settings').select('*').eq('id', 1).single()
  const settings = (data as Settings) ?? DEFAULT_SETTINGS

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-white font-semibold text-lg">Settings</h1>
        <p className="text-[#444] text-xs mt-0.5">
          Configure signal weights, alert thresholds, and integrations
        </p>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  )
}
```

- [ ] **Step 2: Start the dev server and verify settings page**

```bash
npm run dev
```

Open `http://localhost:3000/settings`.

You should see:
- Signal weight sliders (sum should show 100 ✓)
- Social signal toggle and keyword editor
- Threshold number inputs
- Telegram config fields
- "Save Settings" button

Try adjusting a slider so the sum is not 100 — the save button should be disabled and the warning should show. Restore to 100 and save — should succeed (check Supabase table for updated row).

Press `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: implement settings page with all configuration sections"
```

---

### Task 8: Final Test Suite and Build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected:
```
PASS __tests__/lib/env.test.ts           (5 tests)
PASS __tests__/lib/dexscreener.test.ts   (6 tests)
PASS __tests__/lib/jupiter.test.ts       (5 tests)
PASS __tests__/lib/helius.test.ts        (5 tests)
PASS __tests__/lib/ingest.test.ts        (3 tests)
PASS __tests__/lib/disqualifiers.test.ts (9 tests)
PASS __tests__/lib/tier-classifier.test.ts (6 tests)
PASS __tests__/lib/signal-engine.test.ts (18 tests)
PASS __tests__/lib/feed-utils.test.ts    (8 tests)
PASS __tests__/lib/telegram.test.ts      (3 tests)
PASS __tests__/lib/exit-monitor.test.ts  (13 tests)
PASS __tests__/lib/backtester-stats.test.ts (7 tests)

Test Suites: 12 passed
Tests:       88 passed, 88 total
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete SolBeam v1 — all 7 plans implemented, 88 tests passing"
```

---

## Plan 7 Complete — SolBeam v1 is Done

**All 88 tests passing. Full feature set implemented:**

| Plan | Feature | Tests |
|---|---|---|
| 1 — Foundation | Scaffold, DB schema, sidebar layout | 5 |
| 2 — Data Pipeline | DexScreener, Helius, Jupiter, Redis | 19 |
| 3 — Signal Engine | Disqualifiers, composite score, tier classifier | 33 |
| 4 — Live Feed | /dashboard with Realtime | 8 |
| 5 — Paper Trading | /positions, exit monitor, Telegram | 16 |
| 6 — Token Deep-Dive + Wallets | /tokens/[mint], /wallets | 0 (logic in Plans 2–3) |
| 7 — Backtester + Settings | /backtester, /settings | 7 |

**To go live:**
1. Push to GitHub and connect to Vercel
2. Add all env vars to Vercel project settings
3. Set `NEXTAUTH_URL` / `NEXT_PUBLIC_VERCEL_URL` to your deployment URL
4. Vercel will auto-run the two cron jobs (scan + exit-monitor) every minute
5. Add a Telegram bot and register your first smart wallet

**To begin paper trading immediately:**
- Open `/dashboard` → wait for the cron to populate tokens
- Click "Paper Buy" on any token with a score ≥ 70
- Watch `/positions` for live P&L and break-even alerts
