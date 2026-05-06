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
