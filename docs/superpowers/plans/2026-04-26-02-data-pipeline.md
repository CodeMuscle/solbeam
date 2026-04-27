# SolBeam — Plan 2: Data Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-channel data ingest pipeline — DexScreener polling, Helius webhook handler, and Jupiter price fetching — plus the Upstash Redis cache layer that sits between ingest and the signal engine.

**Architecture:** A Vercel cron job calls `/api/cron/scan` every 30 seconds to poll DexScreener for new/trending tokens and upsert raw data into Supabase. Helius webhooks POST to `/api/webhooks/helius` sub-second when a tracked smart wallet transacts. Jupiter is called on-demand for live prices. Redis caches hot token data for 60 seconds to avoid redundant DB reads.

**Tech Stack:** DexScreener REST API (free, no key), Helius REST API + webhooks (free tier), Jupiter Price API v2 (free), Upstash Redis, Supabase Postgres, Next.js API routes.

**Prerequisite:** Plan 1 must be complete. All Supabase tables exist. Redis client is in `lib/redis.ts`. Types are in `lib/types.ts`.

---

## File Map

| File | Responsibility |
|---|---|
| `lib/dexscreener.ts` | DexScreener API client — new pairs, trending, token pairs |
| `lib/helius.ts` | Helius API client — parsed txs, DAS token metadata, webhook CRUD |
| `lib/jupiter.ts` | Jupiter Price API client — spot price for any SPL mint |
| `lib/ingest.ts` | Orchestrates ingest: calls API clients, upserts to Supabase, writes Redis cache |
| `app/api/cron/scan/route.ts` | GET endpoint called by Vercel cron every 30s — triggers DexScreener poll |
| `app/api/webhooks/helius/route.ts` | POST endpoint — validates HMAC, parses Helius payload, records wallet txs |
| `__tests__/lib/dexscreener.test.ts` | Unit tests for DexScreener client (mocked fetch) |
| `__tests__/lib/helius.test.ts` | Unit tests for Helius webhook payload parser |
| `__tests__/lib/jupiter.test.ts` | Unit tests for Jupiter price parser |
| `__tests__/lib/ingest.test.ts` | Unit tests for ingest orchestration logic |

---

### Task 1: DexScreener API Client (TDD)

**Files:**
- Create: `lib/dexscreener.ts`
- Create: `__tests__/lib/dexscreener.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/dexscreener.test.ts`:

```typescript
import {
  fetchNewSolanaPairs,
  fetchTrendingTokens,
  fetchTokenPair,
  type DexPair,
} from '@/lib/dexscreener'

global.fetch = jest.fn()

function mockFetch(data: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

function mockFetchFail() {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })
}

beforeEach(() => jest.clearAllMocks())

const fakePair: DexPair = {
  chainId: 'solana',
  dexId: 'raydium',
  pairAddress: 'pair123',
  baseToken: { address: 'mint123', symbol: 'WOJAK', name: 'Wojak Coin' },
  priceUsd: '0.0012',
  volume: { h24: 50000 },
  liquidity: { usd: 25000 },
  marketCap: 100000,
  pairCreatedAt: 1714000000000,
}

describe('fetchNewSolanaPairs', () => {
  it('returns pairs array from DexScreener response', async () => {
    mockFetch({ pairs: [fakePair] })
    const pairs = await fetchNewSolanaPairs()
    expect(pairs).toHaveLength(1)
    expect(pairs[0].baseToken.symbol).toBe('WOJAK')
  })

  it('returns empty array when DexScreener returns no pairs', async () => {
    mockFetch({ pairs: null })
    const pairs = await fetchNewSolanaPairs()
    expect(pairs).toEqual([])
  })

  it('returns empty array on non-ok response', async () => {
    mockFetchFail()
    const pairs = await fetchNewSolanaPairs()
    expect(pairs).toEqual([])
  })
})

describe('fetchTrendingTokens', () => {
  it('returns trending pairs', async () => {
    mockFetch({ pairs: [fakePair] })
    const pairs = await fetchTrendingTokens()
    expect(pairs).toHaveLength(1)
  })
})

describe('fetchTokenPair', () => {
  it('returns the first pair for a given mint', async () => {
    mockFetch({ pairs: [fakePair] })
    const pair = await fetchTokenPair('mint123')
    expect(pair).not.toBeNull()
    expect(pair!.marketCap).toBe(100000)
  })

  it('returns null when no pairs found', async () => {
    mockFetch({ pairs: [] })
    const pair = await fetchTokenPair('mint123')
    expect(pair).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/dexscreener.test.ts
```

Expected: `Cannot find module '@/lib/dexscreener'`

- [ ] **Step 3: Implement lib/dexscreener.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/dexscreener.ts`:

```typescript
const BASE = 'https://api.dexscreener.com'

export interface DexPair {
  chainId: string
  dexId: string
  pairAddress: string
  baseToken: {
    address: string
    symbol: string
    name: string
  }
  priceUsd: string
  volume: { h24: number }
  liquidity: { usd: number }
  marketCap: number
  pairCreatedAt: number
  txns?: {
    h1?: { buys: number; sells: number }
    m5?: { buys: number; sells: number }
  }
  info?: {
    socials?: Array<{ type: string; url: string }>
    websites?: Array<{ url: string }>
  }
}

async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

export async function fetchNewSolanaPairs(): Promise<DexPair[]> {
  const data = await get<{ pairs: DexPair[] | null }>(
    `${BASE}/token-profiles/latest/v1`
  )
  return data?.pairs ?? []
}

export async function fetchTrendingTokens(): Promise<DexPair[]> {
  const data = await get<{ pairs: DexPair[] | null }>(
    `${BASE}/token-boosts/top/v1`
  )
  return data?.pairs ?? []
}

export async function fetchTokenPair(mintAddress: string): Promise<DexPair | null> {
  const data = await get<{ pairs: DexPair[] | null }>(
    `${BASE}/dex/tokens/${mintAddress}`
  )
  const pairs = data?.pairs ?? []
  const solanaPair = pairs.find((p) => p.chainId === 'solana')
  return solanaPair ?? null
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/dexscreener.test.ts
```

Expected:
```
PASS __tests__/lib/dexscreener.test.ts
  fetchNewSolanaPairs
    ✓ returns pairs array from DexScreener response
    ✓ returns empty array when DexScreener returns no pairs
    ✓ returns empty array on non-ok response
  fetchTrendingTokens
    ✓ returns trending pairs
  fetchTokenPair
    ✓ returns the first pair for a given mint
    ✓ returns null when no pairs found

Tests: 6 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/dexscreener.ts __tests__/lib/dexscreener.test.ts
git commit -m "feat: add DexScreener API client with 6 tests"
```

---

### Task 2: Jupiter Price Client (TDD)

**Files:**
- Create: `lib/jupiter.ts`
- Create: `__tests__/lib/jupiter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/jupiter.test.ts`:

```typescript
import { fetchPrice, fetchPrices } from '@/lib/jupiter'

global.fetch = jest.fn()

function mockFetch(data: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('fetchPrice', () => {
  it('returns price in USD for a known mint', async () => {
    mockFetch({
      data: {
        mint123: { id: 'mint123', mintSymbol: 'WOJAK', price: '0.0012' },
      },
    })
    const price = await fetchPrice('mint123')
    expect(price).toBe(0.0012)
  })

  it('returns null when mint not found in response', async () => {
    mockFetch({ data: {} })
    const price = await fetchPrice('unknownmint')
    expect(price).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })
    const price = await fetchPrice('mint123')
    expect(price).toBeNull()
  })
})

describe('fetchPrices', () => {
  it('returns a map of mint → price for multiple mints', async () => {
    mockFetch({
      data: {
        mint1: { id: 'mint1', price: '1.00' },
        mint2: { id: 'mint2', price: '0.50' },
      },
    })
    const prices = await fetchPrices(['mint1', 'mint2'])
    expect(prices.get('mint1')).toBe(1.0)
    expect(prices.get('mint2')).toBe(0.5)
  })

  it('returns empty map when no mints provided', async () => {
    const prices = await fetchPrices([])
    expect(prices.size).toBe(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/jupiter.test.ts
```

Expected: `Cannot find module '@/lib/jupiter'`

- [ ] **Step 3: Implement lib/jupiter.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/jupiter.ts`:

```typescript
const PRICE_API = 'https://api.jup.ag/price/v2'

interface JupiterPriceData {
  id: string
  mintSymbol?: string
  price: string
}

async function fetchPriceData(
  mints: string[]
): Promise<Record<string, JupiterPriceData> | null> {
  if (mints.length === 0) return {}
  const ids = mints.join(',')
  try {
    const res = await fetch(`${PRICE_API}?ids=${ids}`, { next: { revalidate: 0 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export async function fetchPrice(mintAddress: string): Promise<number | null> {
  const data = await fetchPriceData([mintAddress])
  if (!data) return null
  const entry = data[mintAddress]
  if (!entry) return null
  return parseFloat(entry.price)
}

export async function fetchPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (mintAddresses.length === 0) return result

  const data = await fetchPriceData(mintAddresses)
  if (!data) return result

  for (const [mint, entry] of Object.entries(data)) {
    result.set(mint, parseFloat(entry.price))
  }
  return result
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/jupiter.test.ts
```

Expected:
```
PASS __tests__/lib/jupiter.test.ts
  fetchPrice
    ✓ returns price in USD for a known mint
    ✓ returns null when mint not found in response
    ✓ returns null on fetch failure
  fetchPrices
    ✓ returns a map of mint → price for multiple mints
    ✓ returns empty map when no mints provided

Tests: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/jupiter.ts __tests__/lib/jupiter.test.ts
git commit -m "feat: add Jupiter price client with 5 tests"
```

---

### Task 3: Helius API Client (TDD)

**Files:**
- Create: `lib/helius.ts`
- Create: `__tests__/lib/helius.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/helius.test.ts`:

```typescript
import {
  parseWebhookTransaction,
  classifyTransaction,
  type HeliusWebhookPayload,
} from '@/lib/helius'

const makePayload = (overrides: Partial<HeliusWebhookPayload[0]> = {}): HeliusWebhookPayload => [
  {
    signature: 'sig123abc',
    timestamp: 1714000000,
    type: 'SWAP',
    source: 'RAYDIUM',
    feePayer: 'wallet1abc',
    tokenTransfers: [
      {
        mint: 'So11111111111111111111111111111111111111112',
        tokenAmount: 0.5,
        fromUserAccount: 'wallet1abc',
        toUserAccount: 'pool1',
      },
      {
        mint: 'tokenMint123',
        tokenAmount: 1000000,
        fromUserAccount: 'pool1',
        toUserAccount: 'wallet1abc',
      },
    ],
    nativeTransfers: [],
    ...overrides,
  },
]

describe('parseWebhookTransaction', () => {
  it('extracts signature, wallet, timestamp from a SWAP payload', () => {
    const result = parseWebhookTransaction(makePayload()[0])
    expect(result.signature).toBe('sig123abc')
    expect(result.walletAddress).toBe('wallet1abc')
    expect(result.timestamp).toBeInstanceOf(Date)
  })

  it('identifies the traded token mint (non-SOL side of SWAP)', () => {
    const result = parseWebhookTransaction(makePayload()[0])
    expect(result.tokenMint).toBe('tokenMint123')
  })

  it('returns null for non-SWAP transactions', () => {
    const result = parseWebhookTransaction(
      makePayload({ type: 'TRANSFER' })[0]
    )
    expect(result).toBeNull()
  })
})

describe('classifyTransaction', () => {
  it('classifies as buy when wallet receives the non-SOL token', () => {
    const parsed = parseWebhookTransaction(makePayload()[0])!
    expect(classifyTransaction(parsed)).toBe('buy')
  })

  it('classifies as sell when wallet sends the non-SOL token', () => {
    const sellPayload = makePayload({
      tokenTransfers: [
        {
          mint: 'tokenMint123',
          tokenAmount: 1000000,
          fromUserAccount: 'wallet1abc',
          toUserAccount: 'pool1',
        },
        {
          mint: 'So11111111111111111111111111111111111111112',
          tokenAmount: 0.5,
          fromUserAccount: 'pool1',
          toUserAccount: 'wallet1abc',
        },
      ],
    })[0]
    const parsed = parseWebhookTransaction(sellPayload)!
    expect(classifyTransaction(parsed)).toBe('sell')
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/helius.test.ts
```

Expected: `Cannot find module '@/lib/helius'`

- [ ] **Step 3: Implement lib/helius.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/helius.ts`:

```typescript
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const HELIUS_API = 'https://api.helius.xyz/v0'

export interface HeliusTokenTransfer {
  mint: string
  tokenAmount: number
  fromUserAccount: string
  toUserAccount: string
}

export interface HeliusWebhookPayload extends Array<{
  signature: string
  timestamp: number
  type: string
  source: string
  feePayer: string
  tokenTransfers: HeliusTokenTransfer[]
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>
}> {}

export interface ParsedTransaction {
  signature: string
  walletAddress: string
  timestamp: Date
  tokenMint: string
  tokenSymbol: string | null
  type: 'buy' | 'sell' | 'transfer'
  source: string
  tokenTransfers: HeliusTokenTransfer[]
}

export function parseWebhookTransaction(
  tx: HeliusWebhookPayload[0]
): ParsedTransaction | null {
  if (tx.type !== 'SWAP') return null

  const nonSolTransfer = tx.tokenTransfers.find((t) => t.mint !== SOL_MINT)
  if (!nonSolTransfer) return null

  const parsed: Omit<ParsedTransaction, 'type'> = {
    signature: tx.signature,
    walletAddress: tx.feePayer,
    timestamp: new Date(tx.timestamp * 1000),
    tokenMint: nonSolTransfer.mint,
    tokenSymbol: null,
    source: tx.source,
    tokenTransfers: tx.tokenTransfers,
  }

  return { ...parsed, type: classifyTransaction(parsed as ParsedTransaction) }
}

export function classifyTransaction(
  parsed: Pick<ParsedTransaction, 'walletAddress' | 'tokenTransfers'>
): 'buy' | 'sell' | 'transfer' {
  const nonSolTransfer = parsed.tokenTransfers.find((t) => t.mint !== SOL_MINT)
  if (!nonSolTransfer) return 'transfer'

  if (nonSolTransfer.toUserAccount === parsed.walletAddress) return 'buy'
  if (nonSolTransfer.fromUserAccount === parsed.walletAddress) return 'sell'
  return 'transfer'
}

// ── Helius REST API helpers ──────────────────────────────────────────────────

export async function getTokenMetadata(mintAddress: string) {
  const apiKey = process.env.HELIUS_API_KEY!
  const res = await fetch(
    `${HELIUS_API}/token-metadata?api-key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mintAccounts: [mintAddress],
        includeOffChain: true,
        disableCache: false,
      }),
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data[0] ?? null
}

export async function registerWebhook(walletAddresses: string[]): Promise<string | null> {
  const apiKey = process.env.HELIUS_API_KEY!
  const webhookUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') ?? ''}/api/webhooks/helius`

  const res = await fetch(`${HELIUS_API}/webhooks?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookURL: webhookUrl,
      transactionTypes: ['SWAP'],
      accountAddresses: walletAddresses,
      webhookType: 'enhanced',
      authHeader: process.env.HELIUS_WEBHOOK_SECRET,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.webhookID ?? null
}

export async function deleteWebhook(webhookId: string): Promise<boolean> {
  const apiKey = process.env.HELIUS_API_KEY!
  const res = await fetch(`${HELIUS_API}/webhooks/${webhookId}?api-key=${apiKey}`, {
    method: 'DELETE',
  })
  return res.ok
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/helius.test.ts
```

Expected:
```
PASS __tests__/lib/helius.test.ts
  parseWebhookTransaction
    ✓ extracts signature, wallet, timestamp from a SWAP payload
    ✓ identifies the traded token mint (non-SOL side of SWAP)
    ✓ returns null for non-SWAP transactions
  classifyTransaction
    ✓ classifies as buy when wallet receives the non-SOL token
    ✓ classifies as sell when wallet sends the non-SOL token

Tests: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/helius.ts __tests__/lib/helius.test.ts
git commit -m "feat: add Helius webhook parser and API client with 5 tests"
```

---

### Task 4: Ingest Orchestration (TDD)

**Files:**
- Create: `lib/ingest.ts`
- Create: `__tests__/lib/ingest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/codemuscle/Desktop/solbeam/__tests__/lib/ingest.test.ts`:

```typescript
import { normalizeDexPairToToken } from '@/lib/ingest'
import type { DexPair } from '@/lib/dexscreener'

const fakePair: DexPair = {
  chainId: 'solana',
  dexId: 'raydium',
  pairAddress: 'pair123',
  baseToken: { address: 'mint123', symbol: 'WOJAK', name: 'Wojak Coin' },
  priceUsd: '0.0012',
  volume: { h24: 50000 },
  liquidity: { usd: 25000 },
  marketCap: 100000,
  pairCreatedAt: Date.now() - 60_000, // 1 minute ago
}

describe('normalizeDexPairToToken', () => {
  it('maps DexPair fields to Token shape correctly', () => {
    const token = normalizeDexPairToToken(fakePair, 'raydium')
    expect(token.mint).toBe('mint123')
    expect(token.symbol).toBe('WOJAK')
    expect(token.source).toBe('raydium')
    expect(token.price_usd).toBe(0.0012)
    expect(token.market_cap_usd).toBe(100000)
    expect(token.volume_24h_usd).toBe(50000)
    expect(token.liquidity_usd).toBe(25000)
  })

  it('accepts pump_fun and trending as valid sources', () => {
    const t1 = normalizeDexPairToToken(fakePair, 'pump_fun')
    const t2 = normalizeDexPairToToken(fakePair, 'trending')
    expect(t1.source).toBe('pump_fun')
    expect(t2.source).toBe('trending')
  })

  it('defaults score to 0 and disqualified to false', () => {
    const token = normalizeDexPairToToken(fakePair, 'raydium')
    expect(token.score).toBe(0)
    expect(token.disqualified).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test __tests__/lib/ingest.test.ts
```

Expected: `Cannot find module '@/lib/ingest'`

- [ ] **Step 3: Implement lib/ingest.ts**

Create `/Users/codemuscle/Desktop/solbeam/lib/ingest.ts`:

```typescript
import type { DexPair } from './dexscreener'
import type { Token, TokenSource } from './types'
import { redis, CACHE_TTL } from './redis'

export function normalizeDexPairToToken(
  pair: DexPair,
  source: TokenSource
): Omit<Token, 'created_at' | 'updated_at'> {
  return {
    mint: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    source,
    score: 0,
    disqualified: false,
    disqualify_reason: null,
    tier: null,
    price_usd: parseFloat(pair.priceUsd) || null,
    market_cap_usd: pair.marketCap || null,
    volume_24h_usd: pair.volume.h24 || null,
    liquidity_usd: pair.liquidity.usd || null,
    holder_count: null,
    lp_locked: null,
    mint_renounced: null,
    freeze_disabled: null,
    dev_wallet_pct: null,
    smart_money_count: 0,
    deployer_address: null,
    score_breakdown: null,
  }
}

export async function cacheToken(token: Pick<Token, 'mint'> & Partial<Token>): Promise<void> {
  await redis.setex(`token:${token.mint}`, CACHE_TTL.TOKEN, JSON.stringify(token))
}

export async function getCachedToken(mint: string): Promise<Partial<Token> | null> {
  const cached = await redis.get<string>(`token:${mint}`)
  if (!cached) return null
  return typeof cached === 'string' ? JSON.parse(cached) : cached
}

export async function cachePrice(mint: string, priceUsd: number): Promise<void> {
  await redis.setex(`price:${mint}`, CACHE_TTL.PRICE, priceUsd.toString())
}

export async function getCachedPrice(mint: string): Promise<number | null> {
  const cached = await redis.get<string>(`price:${mint}`)
  if (!cached) return null
  return parseFloat(typeof cached === 'string' ? cached : String(cached))
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
npm test __tests__/lib/ingest.test.ts
```

Expected:
```
PASS __tests__/lib/ingest.test.ts
  normalizeDexPairToToken
    ✓ maps DexPair fields to Token shape correctly
    ✓ accepts pump_fun and trending as valid sources
    ✓ defaults score to 0 and disqualified to false

Tests: 3 passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/ingest.ts __tests__/lib/ingest.test.ts
git commit -m "feat: add ingest orchestration with normalization and Redis cache helpers"
```

---

### Task 5: Helius Webhook Handler

**Files:**
- Modify: `app/api/webhooks/helius/route.ts`

- [ ] **Step 1: Implement the webhook handler**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/api/webhooks/helius/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseWebhookTransaction } from '@/lib/helius'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { HeliusWebhookPayload } from '@/lib/helius'

function verifyHmac(payload: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.HELIUS_WEBHOOK_SECRET!
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()
  const signature = req.headers.get('authorization')

  if (!verifyHmac(rawBody, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: HeliusWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const records = []
  for (const tx of payload) {
    const parsed = parseWebhookTransaction(tx)
    if (!parsed) continue
    records.push({
      wallet_address: parsed.walletAddress,
      signature: parsed.signature,
      type: parsed.type,
      token_mint: parsed.tokenMint,
      token_symbol: parsed.tokenSymbol,
      amount_usd: null,
      dex: parsed.source,
      timestamp: parsed.timestamp.toISOString(),
    })
  }

  if (records.length > 0) {
    const { error } = await supabaseAdmin
      .from('wallet_transactions')
      .upsert(records, { onConflict: 'signature', ignoreDuplicates: true })

    if (error) {
      console.error('Failed to insert wallet_transactions:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  return NextResponse.json({ processed: records.length })
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/helius/route.ts
git commit -m "feat: implement Helius webhook handler with HMAC verification"
```

---

### Task 6: DexScreener Cron Scan Handler

**Files:**
- Modify: `app/api/cron/scan/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Implement the cron scan handler**

Replace the full contents of `/Users/codemuscle/Desktop/solbeam/app/api/cron/scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchNewSolanaPairs, fetchTrendingTokens } from '@/lib/dexscreener'
import { normalizeDexPairToToken, cacheToken } from '@/lib/ingest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TokenSource } from '@/lib/types'

function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET ?? ''}`
}

async function upsertTokens(
  pairs: Awaited<ReturnType<typeof fetchNewSolanaPairs>>,
  source: TokenSource
) {
  if (pairs.length === 0) return 0

  const tokens = pairs.map((pair) => normalizeDexPairToToken(pair, source))

  const { error } = await supabaseAdmin
    .from('tokens')
    .upsert(tokens, { onConflict: 'mint', ignoreDuplicates: false })

  if (error) {
    console.error(`Failed to upsert ${source} tokens:`, error)
    return 0
  }

  await Promise.all(tokens.map((t) => cacheToken(t)))
  return tokens.length
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [newPairs, trendingPairs] = await Promise.all([
    fetchNewSolanaPairs(),
    fetchTrendingTokens(),
  ])

  const [newCount, trendingCount] = await Promise.all([
    upsertTokens(newPairs, 'raydium'),
    upsertTokens(trendingPairs, 'trending'),
  ])

  return NextResponse.json({
    new: newCount,
    trending: trendingCount,
    total: newCount + trendingCount,
  })
}
```

- [ ] **Step 2: Add CRON_SECRET to .env.local**

Open `.env.local` and add:

```env
CRON_SECRET=your-random-secret-here
```

Generate a random value: `openssl rand -hex 16`

Also add it to `.env.local.example`:

```env
# Vercel cron auth
CRON_SECRET=your-random-cron-secret
```

- [ ] **Step 3: Create vercel.json to configure the cron**

Create `/Users/codemuscle/Desktop/solbeam/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

Note: Vercel Hobby plan only supports `*/1` (every minute) as the minimum interval. The spec calls for 30s — on Vercel Hobby, once-per-minute is the best available. On the cron handler itself the work is idempotent (upsert), so running every minute instead of every 30s is safe.

- [ ] **Step 4: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/scan/route.ts vercel.json .env.local.example
git commit -m "feat: implement DexScreener cron scan handler with Vercel cron config"
```

---

### Task 7: Full Test Suite + Build Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected output:
```
PASS __tests__/lib/env.test.ts (5 tests)
PASS __tests__/lib/dexscreener.test.ts (6 tests)
PASS __tests__/lib/jupiter.test.ts (5 tests)
PASS __tests__/lib/helius.test.ts (5 tests)
PASS __tests__/lib/ingest.test.ts (3 tests)

Test Suites: 5 passed, 5 total
Tests:       24 passed, 24 total
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run a production build**

```bash
npm run build
```

Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 4: Commit if any fixes were needed**

If steps 1–3 required any fixes, commit them:

```bash
git add -A
git commit -m "fix: resolve build/test errors from Plan 2"
```

---

## Plan 2 Complete

At this point you have:
- DexScreener client with 6 passing tests
- Jupiter price client with 5 passing tests  
- Helius webhook parser with 5 passing tests
- Ingest normalizer with 3 passing tests (24 total across all libs)
- Helius webhook handler (validates HMAC, parses swaps, writes to DB)
- DexScreener cron scan (polls new + trending, upserts to Supabase, caches in Redis)
- Vercel cron configured to run every minute

**Next:** Plan 3 — Signal Engine (disqualifiers + composite score calculator + tier classifier).
