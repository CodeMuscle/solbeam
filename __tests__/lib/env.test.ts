import { validateEnv } from '@/lib/env'

const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
})

afterAll(() => {
  process.env = originalEnv
})

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  HELIUS_API_KEY: 'test-helius-key',
  HELIUS_WEBHOOK_SECRET: 'test-webhook-secret',
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
}

describe('validateEnv', () => {
  it('returns typed config when all required vars are present', () => {
    process.env = { ...originalEnv, ...validEnv }
    const config = validateEnv()
    expect(config.supabaseUrl).toBe('https://test.supabase.co')
    expect(config.heliusApiKey).toBe('test-helius-key')
    expect(config.upstashRedisUrl).toBe('https://test.upstash.io')
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    process.env = { ...originalEnv, ...validEnv, NEXT_PUBLIC_SUPABASE_URL: undefined }
    expect(() => validateEnv()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('throws when HELIUS_API_KEY is missing', () => {
    process.env = { ...originalEnv, ...validEnv, HELIUS_API_KEY: undefined }
    expect(() => validateEnv()).toThrow('HELIUS_API_KEY')
  })

  it('throws when UPSTASH_REDIS_REST_TOKEN is missing', () => {
    process.env = { ...originalEnv, ...validEnv, UPSTASH_REDIS_REST_TOKEN: undefined }
    expect(() => validateEnv()).toThrow('UPSTASH_REDIS_REST_TOKEN')
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env = { ...originalEnv, ...validEnv, SUPABASE_SERVICE_ROLE_KEY: undefined }
    expect(() => validateEnv()).toThrow('SUPABASE_SERVICE_ROLE_KEY')
  })
})
