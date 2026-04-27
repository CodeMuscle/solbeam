# SolBeam — Plan 5: Paper Trading + Alerts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/positions` page with paper buy/sell, real-time P&L tracking, the exit monitor (polls Jupiter every minute for break-even and take-profit triggers), and Telegram alert delivery. This completes the testable MVP — after this plan you can paper trade and receive real alerts.

**Architecture:** The positions API handles CRUD. A Vercel cron at `/api/cron/exit-monitor` runs every minute, fetches live prices for all open positions from Jupiter, checks exit conditions, and fires Telegram messages. The `/positions` page is a Server Component that fetches open positions and renders a `<PositionTracker>` Client Component that accepts paper buy actions from the live feed.

**Tech Stack:** Next.js 15, Supabase Postgres, Jupiter Price API, Telegram Bot API, Vercel cron.

**Prerequisite:** Plans 1–4 complete. `positions` table exists. `lib/jupiter.ts` and `lib/types.ts` exist. `TokenRow` has a Paper Buy button stub.

---

## File Map

| File | Responsibility |
|---|---|
| `lib/telegram.ts` | Telegram Bot API client — send alert messages |
| `lib/exit-monitor.ts` | Pure logic: check exit conditions for a position given current price |
| `app/api/positions/route.ts` | GET (list open) + POST (open new paper position) |
| `app/api/positions/[id]/route.ts` | PATCH (close position with exit price) |
| `app/api/cron/exit-monitor/route.ts` | Cron: polls prices, checks exits, fires Telegram |
| `app/positions/page.tsx` | Server Component — renders `<PositionTracker>` |
| `components/positions/PositionTracker.tsx` | Client Component — toggle paper/real, position list |
| `components/positions/PositionCard.tsx` | Individual position card with live P&L |
| `components/positions/PnLBadge.tsx` | Colour-coded P&L percentage display |
| `__tests__/lib/exit-monitor.test.ts` | Unit tests for all exit condition logic |
| `__tests__/lib/telegram.test.ts` | Unit tests for message formatting |

---

### Task 1: Telegram Client (TDD)

**Files:**
- Create: `lib/telegram.ts`
- Create: `__tests__/lib/telegram.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/telegram.test.ts`:

```typescript
import { formatExitAlert, formatBreakEvenAlert } from '@/lib/telegram'

describe('formatExitAlert', () => {
  it('formats a MOONSHOT alert correctly', () => {
    const msg = formatExitAlert({
      symbol: 'WOJAK',
      tier: 'MOONSHOT',
      multiplier: 10.5,
      entryPrice: 0.001,
      currentPrice: 0.0105,
    })
    expect(msg).toContain('MOONSHOT')
    expect(msg).toContain('WOJAK')
    expect(msg).toContain('10.5x')
  })

  it('formats a RUNNER alert correctly', () => {
    const msg = formatExitAlert({
      symbol: 'DOGE2',
      tier: 'RUNNER',
      multiplier: 4.2,
      entryPrice: 0.0005,
      currentPrice: 0.0021,
    })
    expect(msg).toContain('RUNNER')
    expect(msg).toContain('4.2x')
  })
})

describe('formatBreakEvenAlert', () => {
  it('formats a break-even alert with symbol and price', () => {
    const msg = formatBreakEvenAlert({ symbol: 'WOJAK', currentPrice: 0.001005 })
    expect(msg).toContain('BREAK-EVEN')
    expect(msg).toContain('WOJAK')
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/telegram.test.ts
```

Expected: `Cannot find module '@/lib/telegram'`

- [ ] **Step 3: Implement lib/telegram.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/telegram.ts`:

```typescript
import type { OutcomeTier } from './types'

const TELEGRAM_API = 'https://api.telegram.org'

export interface ExitAlertParams {
  symbol: string
  tier: OutcomeTier
  multiplier: number
  entryPrice: number
  currentPrice: number
}

export interface BreakEvenAlertParams {
  symbol: string
  currentPrice: number
}

const TIER_EMOJI: Record<OutcomeTier, string> = {
  MOONSHOT: '🚀',
  RUNNER: '🏃',
  MODERATE_PUMP: '📈',
  FLAT: '😐',
  DUMP: '📉',
  RUG: '💀',
}

export function formatExitAlert(params: ExitAlertParams): string {
  const emoji = TIER_EMOJI[params.tier]
  const mult = params.multiplier.toFixed(1)
  return (
    `${emoji} *${params.tier}* — $${params.symbol}\n` +
    `Price hit *${mult}x* from entry\n` +
    `Entry: $${params.entryPrice.toPrecision(4)} → Now: $${params.currentPrice.toPrecision(4)}\n` +
    `Exit now? Check SolBeam dashboard.`
  )
}

export function formatBreakEvenAlert(params: BreakEvenAlertParams): string {
  return (
    `⚠️ *BREAK-EVEN* — $${params.symbol}\n` +
    `Price dropped back to entry level ($${params.currentPrice.toPrecision(4)})\n` +
    `Cut the position to avoid a loss.`
  )
}

export function formatStopLossAlert(symbol: string, lossPercent: number): string {
  return (
    `💀 *STOP-LOSS* — $${symbol}\n` +
    `Down ${lossPercent.toFixed(1)}% from entry. Position auto-flagged.\n` +
    `Consider closing on SolBeam.`
  )
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    console.warn('Telegram not configured — skipping alert')
    return false
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npm test __tests__/lib/telegram.test.ts
```

Expected:
```
PASS __tests__/lib/telegram.test.ts
  formatExitAlert
    ✓ formats a MOONSHOT alert correctly
    ✓ formats a RUNNER alert correctly
  formatBreakEvenAlert
    ✓ formats a break-even alert with symbol and price

Tests: 3 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/telegram.ts __tests__/lib/telegram.test.ts
git commit -m "feat: add Telegram client with alert message formatters (3 tests)"
```

---

### Task 2: Exit Monitor Logic (TDD)

**Files:**
- Create: `lib/exit-monitor.ts`
- Create: `__tests__/lib/exit-monitor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/exit-monitor.test.ts`:

```typescript
import {
  checkExitConditions,
  calcPnlPct,
  calcMultiplier,
  type ExitCheckInput,
  type ExitCondition,
} from '@/lib/exit-monitor'

function makeInput(overrides: Partial<ExitCheckInput> = {}): ExitCheckInput {
  return {
    entryPriceUsd: 1.0,
    currentPriceUsd: 1.0,
    takeProfitTiers: [1.5, 3.0, 10.0],
    stopLossPct: 30,
    stopLossEnabled: true,
    breakEvenFeePct: 0.5,
    alreadyAlertedTiers: new Set(),
    ...overrides,
  }
}

describe('calcPnlPct', () => {
  it('returns 0 at entry price', () => {
    expect(calcPnlPct(1.0, 1.0)).toBe(0)
  })

  it('returns 100 at 2x', () => {
    expect(calcPnlPct(1.0, 2.0)).toBeCloseTo(100)
  })

  it('returns -50 at 0.5x', () => {
    expect(calcPnlPct(1.0, 0.5)).toBeCloseTo(-50)
  })
})

describe('calcMultiplier', () => {
  it('returns 1 at entry price', () => {
    expect(calcMultiplier(1.0, 1.0)).toBe(1)
  })

  it('returns 10 at 10x price', () => {
    expect(calcMultiplier(1.0, 10.0)).toBe(10)
  })
})

describe('checkExitConditions', () => {
  it('returns null when price is at entry and no conditions triggered', () => {
    const result = checkExitConditions(makeInput())
    expect(result).toBeNull()
  })

  it('fires MOONSHOT at 10x (take-profit tier 3)', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 10.5 }))
    expect(result).not.toBeNull()
    expect(result!.type).toBe('MOONSHOT')
    expect(result!.multiplier).toBeCloseTo(10.5)
  })

  it('fires RUNNER at 3x (take-profit tier 2)', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 3.5 }))
    expect(result!.type).toBe('RUNNER')
  })

  it('fires MODERATE_PUMP at 1.5x (take-profit tier 1)', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 1.6 }))
    expect(result!.type).toBe('MODERATE_PUMP')
  })

  it('fires BREAK_EVEN when price drops to entry + 0.5% fee', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 1.004 }))
    expect(result!.type).toBe('BREAK_EVEN')
  })

  it('fires STOP_LOSS when price drops -30%', () => {
    const result = checkExitConditions(makeInput({ currentPriceUsd: 0.69 }))
    expect(result!.type).toBe('STOP_LOSS')
  })

  it('does NOT fire a tier alert that was already alerted', () => {
    const alreadyAlertedTiers = new Set<string>(['MOONSHOT'])
    const result = checkExitConditions(
      makeInput({ currentPriceUsd: 12.0, alreadyAlertedTiers })
    )
    expect(result).toBeNull()
  })

  it('does NOT fire stop-loss when disabled', () => {
    const result = checkExitConditions(
      makeInput({ currentPriceUsd: 0.5, stopLossEnabled: false })
    )
    expect(result?.type).not.toBe('STOP_LOSS')
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/exit-monitor.test.ts
```

Expected: `Cannot find module '@/lib/exit-monitor'`

- [ ] **Step 3: Implement lib/exit-monitor.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/exit-monitor.ts`:

```typescript
export interface ExitCheckInput {
  entryPriceUsd: number
  currentPriceUsd: number
  takeProfitTiers: number[]  // multipliers e.g. [1.5, 3.0, 10.0]
  stopLossPct: number        // e.g. 30 means -30%
  stopLossEnabled: boolean
  breakEvenFeePct: number    // e.g. 0.5 means entry×1.005 is break-even floor
  alreadyAlertedTiers: Set<string>
}

export type ExitConditionType = 'MOONSHOT' | 'RUNNER' | 'MODERATE_PUMP' | 'BREAK_EVEN' | 'STOP_LOSS'

export interface ExitCondition {
  type: ExitConditionType
  multiplier: number
  pnlPct: number
}

const TIER_NAMES: Record<number, ExitConditionType> = {
  0: 'MODERATE_PUMP',
  1: 'RUNNER',
  2: 'MOONSHOT',
}

export function calcPnlPct(entryPrice: number, currentPrice: number): number {
  return ((currentPrice - entryPrice) / entryPrice) * 100
}

export function calcMultiplier(entryPrice: number, currentPrice: number): number {
  return currentPrice / entryPrice
}

export function checkExitConditions(input: ExitCheckInput): ExitCondition | null {
  const multiplier = calcMultiplier(input.entryPriceUsd, input.currentPriceUsd)
  const pnlPct = calcPnlPct(input.entryPriceUsd, input.currentPriceUsd)
  const breakEvenFloor = input.entryPriceUsd * (1 + input.breakEvenFeePct / 100)

  // Check take-profit tiers (highest first so MOONSHOT fires before RUNNER)
  const sortedTiers = [...input.takeProfitTiers].sort((a, b) => b - a)
  for (let i = 0; i < sortedTiers.length; i++) {
    const tierMultiplier = sortedTiers[i]
    const tierName = TIER_NAMES[sortedTiers.length - 1 - i] ?? 'MODERATE_PUMP'

    if (multiplier >= tierMultiplier && !input.alreadyAlertedTiers.has(tierName)) {
      return { type: tierName, multiplier, pnlPct }
    }
  }

  // Break-even: price dropped back to entry + fee
  if (
    input.currentPriceUsd <= breakEvenFloor &&
    input.currentPriceUsd >= input.entryPriceUsd * 0.99 &&
    !input.alreadyAlertedTiers.has('BREAK_EVEN')
  ) {
    return { type: 'BREAK_EVEN', multiplier, pnlPct }
  }

  // Stop-loss
  if (
    input.stopLossEnabled &&
    pnlPct <= -input.stopLossPct &&
    !input.alreadyAlertedTiers.has('STOP_LOSS')
  ) {
    return { type: 'STOP_LOSS', multiplier, pnlPct }
  }

  return null
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npm test __tests__/lib/exit-monitor.test.ts
```

Expected:
```
PASS __tests__/lib/exit-monitor.test.ts
  calcPnlPct
    ✓ returns 0 at entry price
    ✓ returns 100 at 2x
    ✓ returns -50 at 0.5x
  calcMultiplier
    ✓ returns 1 at entry price
    ✓ returns 10 at 10x price
  checkExitConditions
    ✓ returns null when price is at entry and no conditions triggered
    ✓ fires MOONSHOT at 10x (take-profit tier 3)
    ✓ fires RUNNER at 3x (take-profit tier 2)
    ✓ fires MODERATE_PUMP at 1.5x (take-profit tier 1)
    ✓ fires BREAK_EVEN when price drops to entry + 0.5% fee
    ✓ fires STOP_LOSS when price drops -30%
    ✓ does NOT fire a tier alert that was already alerted
    ✓ does NOT fire stop-loss when disabled

Tests: 13 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/exit-monitor.ts __tests__/lib/exit-monitor.test.ts
git commit -m "feat: add exit monitor logic with 13 tests"
```

---

### Task 3: Positions API Routes

**Files:**
- Modify: `app/api/positions/route.ts`
- Create: `app/api/positions/[id]/route.ts`

- [ ] **Step 1: Implement the positions GET + POST handler**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/api/positions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchPrice } from '@/lib/jupiter'
import { calcPnlPct } from '@/lib/exit-monitor'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('status', 'open')
    .order('entry_timestamp', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with live prices
  const mints = [...new Set(data.map((p) => p.token_mint).filter(Boolean))]
  const prices = mints.length > 0
    ? await Promise.all(mints.map((m) => fetchPrice(m).then((price) => [m, price] as const)))
    : []
  const priceMap = new Map(prices.filter(([, price]) => price !== null) as [string, number][])

  const enriched = data.map((position) => {
    const currentPrice = priceMap.get(position.token_mint) ?? null
    const pnlPct = currentPrice
      ? calcPnlPct(position.entry_price_usd, currentPrice)
      : null
    return { ...position, current_price_usd: currentPrice, pnl_pct: pnlPct }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    token_mint: string
    token_symbol: string
    entry_price_usd: number
    entry_score?: number
    mode?: 'paper' | 'real'
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.token_mint || !body.entry_price_usd) {
    return NextResponse.json(
      { error: 'token_mint and entry_price_usd are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('positions')
    .insert({
      token_mint: body.token_mint,
      token_symbol: body.token_symbol,
      entry_price_usd: body.entry_price_usd,
      entry_score: body.entry_score ?? null,
      mode: body.mode ?? 'paper',
      notes: body.notes ?? null,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create the position close handler**

Create `/Users/codemuscle/Desktop/solbeam/app/api/positions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcPnlPct, calcMultiplier } from '@/lib/exit-monitor'
import { classifyTier } from '@/lib/tier-classifier'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params

  let body: { exit_price_usd: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Fetch the position to calculate outcome
  const { data: position, error: fetchError } = await supabaseAdmin
    .from('positions')
    .select('entry_price_usd')
    .eq('id', id)
    .single()

  if (fetchError || !position) {
    return NextResponse.json({ error: 'Position not found' }, { status: 404 })
  }

  const pnlPct = calcPnlPct(position.entry_price_usd, body.exit_price_usd)
  const multiplier = calcMultiplier(position.entry_price_usd, body.exit_price_usd)
  const outcomeTier = classifyTier(multiplier)

  const { data, error } = await supabaseAdmin
    .from('positions')
    .update({
      exit_price_usd: body.exit_price_usd,
      exit_timestamp: new Date().toISOString(),
      pnl_pct: pnlPct,
      outcome_tier: outcomeTier,
      status: 'closed',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/positions/route.ts app/api/positions/\[id\]/route.ts
git commit -m "feat: implement positions API (GET open, POST new, PATCH close)"
```

---

### Task 4: Exit Monitor Cron Route

**Files:**
- Create: `app/api/cron/exit-monitor/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Implement the exit monitor cron route**

Create `/Users/codemuscle/Desktop/solbeam/app/api/cron/exit-monitor/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchPrices } from '@/lib/jupiter'
import { checkExitConditions, calcPnlPct } from '@/lib/exit-monitor'
import {
  sendTelegramMessage,
  formatExitAlert,
  formatBreakEvenAlert,
  formatStopLossAlert,
} from '@/lib/telegram'
import type { OutcomeTier } from '@/lib/types'

function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET ?? ''}`
}

const TIER_TO_OUTCOME: Record<string, OutcomeTier> = {
  MOONSHOT: 'MOONSHOT',
  RUNNER: 'RUNNER',
  MODERATE_PUMP: 'MODERATE_PUMP',
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch settings
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('take_profit_tiers, stop_loss_pct, break_even_fee_pct')
    .eq('id', 1)
    .single()

  const takeProfitTiers: number[] = settings?.take_profit_tiers ?? [1.5, 3.0, 10.0]
  const stopLossPct: number = settings?.stop_loss_pct ?? 30
  const breakEvenFeePct: number = settings?.break_even_fee_pct ?? 0.5

  // Fetch all open positions
  const { data: positions, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('status', 'open')

  if (error || !positions) {
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }

  if (positions.length === 0) {
    return NextResponse.json({ checked: 0, alerts: 0 })
  }

  // Fetch live prices for all open position mints
  const mints = [...new Set(positions.map((p) => p.token_mint).filter(Boolean))]
  const priceMap = await fetchPrices(mints)

  let alertsFired = 0

  for (const position of positions) {
    const currentPrice = priceMap.get(position.token_mint)
    if (!currentPrice) continue

    const alreadyAlerted = new Set<string>(position.notes ? JSON.parse(position.notes ?? '[]') : [])

    const exitCondition = checkExitConditions({
      entryPriceUsd: position.entry_price_usd,
      currentPriceUsd: currentPrice,
      takeProfitTiers,
      stopLossPct,
      stopLossEnabled: stopLossPct > 0,
      breakEvenFeePct,
      alreadyAlertedTiers: alreadyAlerted,
    })

    if (!exitCondition) continue

    // Send Telegram alert
    let message: string
    if (exitCondition.type === 'BREAK_EVEN') {
      message = formatBreakEvenAlert({
        symbol: position.token_symbol ?? position.token_mint.slice(0, 8),
        currentPrice,
      })
    } else if (exitCondition.type === 'STOP_LOSS') {
      message = formatStopLossAlert(
        position.token_symbol ?? position.token_mint.slice(0, 8),
        Math.abs(exitCondition.pnlPct)
      )
    } else {
      message = formatExitAlert({
        symbol: position.token_symbol ?? position.token_mint.slice(0, 8),
        tier: TIER_TO_OUTCOME[exitCondition.type] ?? 'MODERATE_PUMP',
        multiplier: exitCondition.multiplier,
        entryPrice: position.entry_price_usd,
        currentPrice,
      })
    }

    await sendTelegramMessage(message)
    alertsFired++

    // Record which tiers have been alerted (stored in notes as JSON array)
    const updatedAlerted = [...alreadyAlerted, exitCondition.type]
    const pnlPct = calcPnlPct(position.entry_price_usd, currentPrice)

    await supabaseAdmin
      .from('positions')
      .update({
        pnl_pct: pnlPct,
        notes: JSON.stringify(updatedAlerted),
      })
      .eq('id', position.id)
  }

  return NextResponse.json({ checked: positions.length, alerts: alertsFired })
}
```

- [ ] **Step 2: Add the exit monitor to vercel.json**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/exit-monitor",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/exit-monitor/route.ts vercel.json
git commit -m "feat: add exit monitor cron route with Telegram alerts"
```

---

### Task 5: Position UI Components

**Files:**
- Create: `components/positions/PnLBadge.tsx`
- Create: `components/positions/PositionCard.tsx`

- [ ] **Step 1: Create PnLBadge**

Create `/Users/codemuscle/Desktop/solbeam/components/positions/PnLBadge.tsx`:

```tsx
interface Props {
  pnlPct: number | null
}

export function PnLBadge({ pnlPct }: Props) {
  if (pnlPct === null) {
    return <span className="text-[#444] text-sm tabular-nums">—</span>
  }

  const isPositive = pnlPct >= 0
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400'
  const prefix = isPositive ? '+' : ''

  return (
    <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
      {prefix}{pnlPct.toFixed(1)}%
    </span>
  )
}
```

- [ ] **Step 2: Create PositionCard**

Create `/Users/codemuscle/Desktop/solbeam/components/positions/PositionCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { PnLBadge } from './PnLBadge'
import { TierBadge } from '@/components/feed/TierBadge'
import { ScorePill } from '@/components/feed/ScorePill'
import type { Position } from '@/lib/types'

interface EnrichedPosition extends Position {
  current_price_usd: number | null
}

interface Props {
  position: EnrichedPosition
  onClose: (id: string, exitPrice: number) => Promise<void>
}

export function PositionCard({ position, onClose }: Props) {
  const [closing, setClosing] = useState(false)

  const multiplier = position.current_price_usd
    ? position.current_price_usd / position.entry_price_usd
    : null

  const isNearBreakEven =
    position.current_price_usd !== null &&
    position.current_price_usd <= position.entry_price_usd * 1.01 &&
    position.current_price_usd >= position.entry_price_usd * 0.95

  async function handleClose() {
    if (!position.current_price_usd) return
    setClosing(true)
    await onClose(position.id, position.current_price_usd)
    setClosing(false)
  }

  return (
    <div
      className={`bg-[#0e0e0e] border rounded-lg p-4 transition-colors ${
        isNearBreakEven
          ? 'border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
          : 'border-[#1e1e1e]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">{position.token_symbol ?? 'Unknown'}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
              position.mode === 'paper'
                ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                : 'text-green-400 border-green-500/30 bg-green-500/10'
            }`}
          >
            {position.mode === 'paper' ? 'PAPER' : 'REAL'}
          </span>
          {position.entry_score && <ScorePill score={position.entry_score} size="sm" />}
        </div>
        {position.tier && <TierBadge tier={position.tier} />}
      </div>

      {/* Price row */}
      <div className="grid grid-cols-3 gap-4 mb-3 text-center">
        <div>
          <div className="text-[#444] text-xs mb-1">Entry</div>
          <div className="text-[#888] text-sm font-mono">
            ${position.entry_price_usd.toPrecision(4)}
          </div>
        </div>
        <div>
          <div className="text-[#444] text-xs mb-1">Current</div>
          <div className="text-[#ccc] text-sm font-mono">
            {position.current_price_usd
              ? `$${position.current_price_usd.toPrecision(4)}`
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-[#444] text-xs mb-1">P&L</div>
          <PnLBadge pnlPct={position.pnl_pct} />
        </div>
      </div>

      {/* Multiplier */}
      {multiplier !== null && (
        <div className="text-center mb-3">
          <span className={`text-lg font-bold tabular-nums ${
            multiplier >= 1 ? 'text-green-400' : 'text-red-400'
          }`}>
            {multiplier.toFixed(2)}x
          </span>
        </div>
      )}

      {/* Break-even warning */}
      {isNearBreakEven && (
        <div className="text-amber-400 text-xs text-center mb-3 animate-pulse">
          ⚠️ Near break-even — consider exiting
        </div>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        disabled={closing || !position.current_price_usd}
        className="w-full text-xs py-2 rounded border border-[#2a2a2a] text-[#666] hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {closing ? 'Closing…' : `Close at $${position.current_price_usd?.toPrecision(4) ?? '—'}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/positions/PnLBadge.tsx components/positions/PositionCard.tsx
git commit -m "feat: add PnLBadge and PositionCard components"
```

---

### Task 6: PositionTracker Client Component

**Files:**
- Create: `components/positions/PositionTracker.tsx`

- [ ] **Step 1: Create PositionTracker**

Create `/Users/codemuscle/Desktop/solbeam/components/positions/PositionTracker.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { PositionCard } from './PositionCard'
import type { Position } from '@/lib/types'

interface EnrichedPosition extends Position {
  current_price_usd: number | null
}

interface Props {
  initialPositions: EnrichedPosition[]
}

export function PositionTracker({ initialPositions }: Props) {
  const [positions, setPositions] = useState<EnrichedPosition[]>(initialPositions)
  const [modeFilter, setModeFilter] = useState<'paper' | 'real' | 'all'>('all')

  const handleClose = useCallback(async (id: string, exitPrice: number) => {
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exit_price_usd: exitPrice }),
    })
    if (res.ok) {
      setPositions((prev) => prev.filter((p) => p.id !== id))
    }
  }, [])

  const filtered = positions.filter(
    (p) => modeFilter === 'all' || p.mode === modeFilter
  )

  return (
    <div>
      {/* Mode filter tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-[#1a1a1a]">
        {(['all', 'paper', 'real'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setModeFilter(mode)}
            className={`text-xs px-3 py-1.5 rounded capitalize transition-colors ${
              modeFilter === mode
                ? 'bg-[#1e1e1e] text-white border border-[#2a2a2a]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {mode}
          </button>
        ))}
        <span className="ml-auto text-[#333] text-xs">
          {filtered.length} open position{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Position grid */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#333] text-sm">No open positions</p>
            <p className="text-[#222] text-xs mt-2">
              Use the &ldquo;Paper Buy&rdquo; button on the Live Feed to open a paper trade.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onClose={handleClose}
              />
            ))}
          </div>
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
git add components/positions/PositionTracker.tsx
git commit -m "feat: add PositionTracker client component with close flow"
```

---

### Task 7: Positions Page + Wire Paper Buy Button

**Files:**
- Modify: `app/positions/page.tsx`
- Modify: `components/feed/TokenRow.tsx`

- [ ] **Step 1: Implement the positions page**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/positions/page.tsx`:

```tsx
import { PositionTracker } from '@/components/positions/PositionTracker'

export const dynamic = 'force-dynamic'

export default async function PositionsPage() {
  // Fetch open positions with live prices via our own API
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000'

  let positions = []
  try {
    const res = await fetch(`${baseUrl}/api/positions`, { cache: 'no-store' })
    if (res.ok) positions = await res.json()
  } catch {
    // Positions will be empty on first load if API is unreachable
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-white font-semibold text-lg">Positions</h1>
          <p className="text-[#444] text-xs mt-0.5">
            Track paper and real trades · Exit monitor runs every minute
          </p>
        </div>
      </div>

      <PositionTracker initialPositions={positions} />
    </div>
  )
}
```

- [ ] **Step 2: Wire the Paper Buy button in TokenRow**

Replace the Paper Buy button in `/Users/codemuscle/Desktop/solbeam/components/feed/TokenRow.tsx`:

Find this block:

```tsx
      {/* Paper Buy button */}
      <td className="px-4 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            // Paper buy handled in Plan 5
          }}
          className="text-xs px-2.5 py-1 rounded border border-[#2a2a2a] text-[#666] hover:border-green-500/50 hover:text-green-400 transition-colors"
        >
          Paper Buy
        </button>
      </td>
```

Replace it with:

```tsx
      {/* Paper Buy button */}
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
```

- [ ] **Step 3: Start the dev server and test the full flow**

```bash
npm run dev
```

1. Open `http://localhost:3000/dashboard`
2. If no tokens are present, seed one via Supabase SQL editor (same as Plan 4 step 9)
3. Click "Paper Buy" on any token row with a price
4. You should be redirected to `http://localhost:3000/positions`
5. The position card should appear with the token symbol, entry price, and "PAPER" badge
6. Click "Close at $…" to close the position

Press `Ctrl+C`.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all previous tests pass plus 13 new exit monitor tests + 3 new telegram tests = 81 total.

- [ ] **Step 5: Commit**

```bash
git add app/positions/page.tsx components/feed/TokenRow.tsx
git commit -m "feat: implement positions page and wire paper buy from live feed"
```

---

### Task 8: Build Verification

**Files:** none (verification only)

- [ ] **Step 1: Run TypeScript check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both complete with no errors.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build/test issues from Plan 5"
```

---

## Plan 5 Complete

At this point you have the full testable MVP:
- Telegram alert client with message formatters (3 tests)
- Exit monitor logic covering all 5 exit conditions (13 tests)
- Positions API (open, list, close)
- Exit monitor cron running every minute on Vercel
- Positions page with paper trade cards showing live P&L and break-even warnings
- Paper Buy wired from live feed → positions page
- 81 total passing tests
- Clean production build

**To receive real Telegram alerts:**
1. Create a Telegram bot via [@BotFather](https://t.me/BotFather) → get bot token
2. Get your chat ID (message the bot, then call `https://api.telegram.org/bot<token>/getUpdates`)
3. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to your `.env.local` and Vercel env vars

**Next:** Plan 6 — Token Deep-Dive (`/tokens/[mint]`) + Wallet Tracker (`/wallets`).
