import { NextRequest, NextResponse } from 'next/server'
import { handleCommand, type TelegramMessage } from '@/lib/telegram-commands'

const TELEGRAM_API = 'https://api.telegram.org'

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage & { message_id: number }
}

async function sendReply(chatId: number, text: string, parseMode?: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token')

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = update.message
  if (!message?.text || !message.from) {
    return NextResponse.json({ ok: true })
  }

  // Owner-only: from.id must match TELEGRAM_CHAT_ID
  const ownerId = process.env.TELEGRAM_CHAT_ID
  if (ownerId && String(message.from.id) !== ownerId && String(message.chat.id) !== ownerId) {
    return NextResponse.json({ ok: true })
  }

  const response = await handleCommand(message)
  if (response) {
    await sendReply(message.chat.id, response.text, response.parseMode)
  }

  return NextResponse.json({ ok: true })
}
