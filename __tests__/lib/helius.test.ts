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
