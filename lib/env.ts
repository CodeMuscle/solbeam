const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'HELIUS_API_KEY',
  'HELIUS_WEBHOOK_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

export function validateEnv() {
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    heliusApiKey: process.env.HELIUS_API_KEY!,
    heliusWebhookSecret: process.env.HELIUS_WEBHOOK_SECRET!,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL!,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN!,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
  }
}
