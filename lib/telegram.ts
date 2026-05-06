import type { OutcomeTier } from './types'

const TELEGRAM_API = 'https://api.telegram.org'

export interface ExitAlertParams {
  symbol: string
  tier: OutcomeTier
  multiplier: number
  entryPrice: number
  currentPrice: number
}

export interface BreakEvenAlertParams {
  symbol: string
  currentPrice: number
}

const TIER_EMOJI: Record<OutcomeTier, string> = {
  MOONSHOT: '🚀',
  RUNNER: '🏃',
  MODERATE_PUMP: '📈',
  FLAT: '😐',
  DUMP: '📉',
  RUG: '💀',
}

export function formatExitAlert(params: ExitAlertParams): string {
  const emoji = TIER_EMOJI[params.tier]
  const mult = params.multiplier.toFixed(1)
  return (
    `${emoji} *${params.tier}* — $${params.symbol}\n` +
    `Price hit *${mult}x* from entry\n` +
    `Entry: $${params.entryPrice.toPrecision(4)} → Now: $${params.currentPrice.toPrecision(4)}\n` +
    `Exit now? Check SolBeam dashboard.`
  )
}

export function formatBreakEvenAlert(params: BreakEvenAlertParams): string {
  return (
    `⚠️ *BREAK-EVEN* — $${params.symbol}\n` +
    `Price dropped back to entry level ($${params.currentPrice.toPrecision(4)})\n` +
    `Cut the position to avoid a loss.`
  )
}

export function formatStopLossAlert(symbol: string, lossPercent: number): string {
  return (
    `💀 *STOP-LOSS* — $${symbol}\n` +
    `Down ${lossPercent.toFixed(1)}% from entry. Position auto-flagged.\n` +
    `Consider closing on SolBeam.`
  )
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    console.warn('Telegram not configured — skipping alert')
    return false
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
