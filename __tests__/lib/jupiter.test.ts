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
