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
  priceChange?: {
    m5?: number
    h1?: number
    h6?: number
    h24?: number
  }
  info?: {
    socials?: Array<{ type: string; url: string }>
    websites?: Array<{ url: string }>
  }
}

interface TokenRef {
  chainId: string
  tokenAddress: string
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

async function fetchPairsForMints(mints: string[]): Promise<DexPair[]> {
  if (mints.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < mints.length; i += 30) {
    chunks.push(mints.slice(i, i + 30))
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      get<{ pairs: DexPair[] | null }>(`${BASE}/latest/dex/tokens/${chunk.join(',')}`)
    )
  )
  const allPairs = results
    .flatMap((r) => r?.pairs ?? [])
    .filter((p) => p.chainId === 'solana')

  // Dedupe by mint — keep highest-liquidity pair per token
  const byMint = new Map<string, DexPair>()
  for (const pair of allPairs) {
    const mint = pair.baseToken.address
    const existing = byMint.get(mint)
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      byMint.set(mint, pair)
    }
  }
  return Array.from(byMint.values())
}

function pickBestSolanaPair(pairs: DexPair[]): DexPair | null {
  const solanaPairs = pairs.filter((p) => p.chainId === 'solana')
  if (solanaPairs.length === 0) return null
  return solanaPairs.reduce((best, p) =>
    (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? p : best
  )
}

export async function fetchNewSolanaPairs(): Promise<DexPair[]> {
  const profiles = await get<TokenRef[]>(`${BASE}/token-profiles/latest/v1`)
  if (!profiles || !Array.isArray(profiles)) return []
  const solanaTokens = profiles
    .filter((p) => p.chainId === 'solana')
    .map((p) => p.tokenAddress)
    .slice(0, 30)
  return fetchPairsForMints(solanaTokens)
}

export async function fetchTrendingTokens(): Promise<DexPair[]> {
  const boosts = await get<TokenRef[]>(`${BASE}/token-boosts/top/v1`)
  if (!boosts || !Array.isArray(boosts)) return []
  const solanaTokens = boosts
    .filter((b) => b.chainId === 'solana')
    .map((b) => b.tokenAddress)
    .slice(0, 30)
  return fetchPairsForMints(solanaTokens)
}

export async function fetchTokenPair(mintAddress: string): Promise<DexPair | null> {
  const data = await get<{ pairs: DexPair[] | null }>(
    `${BASE}/latest/dex/tokens/${mintAddress}`
  )
  return pickBestSolanaPair(data?.pairs ?? [])
}
