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
