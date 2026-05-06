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
