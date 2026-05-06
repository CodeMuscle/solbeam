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
