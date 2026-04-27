import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const CACHE_TTL = {
  TOKEN: 60,        // 60 seconds — token scores
  PRICE: 15,        // 15 seconds — price data
  HOLDER_DATA: 300, // 5 minutes — holder counts change slowly
} as const
