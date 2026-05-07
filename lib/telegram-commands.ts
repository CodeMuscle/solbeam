import { supabaseAdmin } from './supabase/admin'
import { redis } from './redis'
import { fetchPrice, fetchPrices } from './jupiter'
import { calcPnlPct } from './exit-monitor'
import type { Token, Position, TrackedWallet } from './types'

export interface TelegramMessage {
  text?: string
  from?: { id: number }
  chat: { id: number }
}

export interface CommandResponse {
  text: string
  parseMode?: 'Markdown' | 'HTML'
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const MUTE_KEY = 'solbeam:alerts:muted'

export async function isAlertsMuted(): Promise<boolean> {
  try {
    const muted = await redis.get(MUTE_KEY)
    return muted !== null
  } catch {
    return false
  }
}

export async function muteAlerts(seconds: number): Promise<void> {
  await redis.setex(MUTE_KEY, seconds, '1')
}

export async function unmuteAlerts(): Promise<void> {
  await redis.del(MUTE_KEY)
}

export async function handleCommand(message: TelegramMessage): Promise<CommandResponse | null> {
  const text = message.text?.trim() ?? ''
  if (!text.startsWith('/')) return null

  const [rawCommand, ...args] = text.split(/\s+/)
  const cmd = rawCommand.split('@')[0].toLowerCase()

  switch (cmd) {
    case '/start': return handleStart()
    case '/help': return handleHelp()
    case '/dashboard': return handleDashboard()
    case '/status': return handleStatus()
    case '/positions': return handlePositions()
    case '/feed': return handleFeed()
    case '/score': return handleScore(args[0])
    case '/wallets': return handleWallets()
    case '/mute': return handleMute(args[0])
    case '/unmute': return handleUnmute()
    default:
      return { text: `Unknown command. Send /help for the full list.` }
  }
}

function handleStart(): CommandResponse {
  return {
    text:
      `🔆 *Welcome to SolBeam*\n\n` +
      `Your personal Solana memecoin intelligence relay.\n\n` +
      `This bot sends real-time alerts when tracked tokens hit price targets and gives you on-demand access to your dashboard data.\n\n` +
      `Send /help for the full command list, or /dashboard to open the web app.`,
    parseMode: 'Markdown',
  }
}

function handleHelp(): CommandResponse {
  return {
    text:
      `*SolBeam Bot — Commands*\n\n` +
      `📊 *Data*\n` +
      `/status — open positions + P&L summary\n` +
      `/positions — list all open paper trades\n` +
      `/feed — top 5 scoring tokens right now\n` +
      `/score \`<mint>\` — score breakdown for a token\n` +
      `/wallets — tracked smart-money wallets\n\n` +
      `🔕 *Alerts*\n` +
      `/mute \`[hours]\` — silence alerts (default 1h)\n` +
      `/unmute — resume alert delivery\n\n` +
      `🔗 *Other*\n` +
      `/dashboard — open the web app\n` +
      `/help — show this menu`,
    parseMode: 'Markdown',
  }
}

function handleDashboard(): CommandResponse {
  return {
    text: `🔗 [Open SolBeam Dashboard](${APP_URL}/dashboard)`,
    parseMode: 'Markdown',
  }
}

async function handleStatus(): Promise<CommandResponse> {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('mode, pnl_pct, token_mint, entry_price_usd')
    .eq('status', 'open')

  if (error) return { text: `⚠️ DB error: ${error.message}` }
  if (!data || data.length === 0) {
    return { text: '📭 No open positions.\n\nUse /feed to find tokens to paper trade.', parseMode: 'Markdown' }
  }

  const paper = data.filter((p) => p.mode === 'paper').length
  const real = data.filter((p) => p.mode === 'real').length

  // Live PnL via Jupiter
  const mints = [...new Set(data.map((p) => p.token_mint).filter(Boolean))]
  const priceMap = await fetchPrices(mints)
  const livePnls = data
    .map((p) => {
      const price = priceMap.get(p.token_mint)
      return price ? calcPnlPct(p.entry_price_usd, price) : null
    })
    .filter((p): p is number => p !== null)

  const avgPnl = livePnls.length > 0
    ? livePnls.reduce((s, p) => s + p, 0) / livePnls.length
    : 0

  const muted = await isAlertsMuted()

  return {
    text:
      `📊 *Status*\n\n` +
      `Paper open: ${paper}\n` +
      `Real open: ${real}\n` +
      `Live avg P&L: ${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%\n` +
      `Alerts: ${muted ? '🔕 muted' : '🔔 active'}\n\n` +
      `[Dashboard](${APP_URL}/positions)`,
    parseMode: 'Markdown',
  }
}

async function handlePositions(): Promise<CommandResponse> {
  const { data } = await supabaseAdmin
    .from('positions')
    .select('id, token_symbol, token_mint, entry_price_usd, entry_score, mode')
    .eq('status', 'open')
    .order('entry_timestamp', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) {
    return { text: '📭 No open positions.', parseMode: 'Markdown' }
  }

  const positions = data as Pick<Position, 'id' | 'token_symbol' | 'token_mint' | 'entry_price_usd' | 'entry_score' | 'mode'>[]

  const mints = [...new Set(positions.map((p) => p.token_mint).filter(Boolean))]
  const priceMap = await fetchPrices(mints)

  const lines = positions.map((p) => {
    const live = priceMap.get(p.token_mint)
    const pnl = live ? calcPnlPct(p.entry_price_usd, live) : null
    const pnlStr = pnl !== null
      ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`
      : '—'
    const tag = p.mode === 'paper' ? '📝' : '💰'
    return `${tag} *${p.token_symbol ?? p.token_mint.slice(0, 6)}* · score ${p.entry_score ?? '—'} · ${pnlStr}`
  })

  return {
    text: `*Open Positions* (${positions.length})\n\n${lines.join('\n')}\n\n[Manage](${APP_URL}/positions)`,
    parseMode: 'Markdown',
  }
}

async function handleFeed(): Promise<CommandResponse> {
  const { data } = await supabaseAdmin
    .from('tokens')
    .select('mint, symbol, score, tier, market_cap_usd')
    .eq('disqualified', false)
    .order('score', { ascending: false })
    .limit(5)

  if (!data || data.length === 0) {
    return { text: '📭 No scored tokens yet. Wait for the cron to populate.' }
  }

  const tokens = data as Pick<Token, 'mint' | 'symbol' | 'score' | 'tier' | 'market_cap_usd'>[]

  const lines = tokens.map((t, i) => {
    const mc = t.market_cap_usd
      ? t.market_cap_usd >= 1_000_000
        ? `$${(t.market_cap_usd / 1_000_000).toFixed(1)}M`
        : `$${(t.market_cap_usd / 1_000).toFixed(0)}K`
      : '—'
    return `${i + 1}. *${t.symbol ?? t.mint.slice(0, 6)}* — score *${t.score}* · ${t.tier ?? 'unscored'} · ${mc}`
  })

  return {
    text: `🔥 *Top 5 Tokens*\n\n${lines.join('\n')}\n\n[Live feed](${APP_URL}/dashboard)`,
    parseMode: 'Markdown',
  }
}

async function handleScore(mint: string | undefined): Promise<CommandResponse> {
  if (!mint) {
    return { text: '⚠️ Usage: `/score <mint_address>`', parseMode: 'Markdown' }
  }

  const { data } = await supabaseAdmin
    .from('tokens')
    .select('*')
    .eq('mint', mint)
    .single()

  if (!data) {
    return { text: `❌ Token not found in database: \`${mint.slice(0, 16)}…\``, parseMode: 'Markdown' }
  }

  const t = data as Token
  const bd = t.score_breakdown

  let body = `🔍 *${t.symbol ?? mint.slice(0, 8)}*\n\n` +
    `Score: *${t.score}/100*\n` +
    `Tier: ${t.tier ?? '—'}\n` +
    `Source: ${t.source}\n`

  if (t.disqualified) {
    body += `\n⛔ *Disqualified*: ${t.disqualify_reason}\n`
  }

  if (bd) {
    body +=
      `\n*Breakdown*\n` +
      `🐋 Smart Money: ${bd.smartMoney.total}/30\n` +
      `🔒 Token Health: ${bd.tokenHealth.total}/25\n` +
      `📈 Momentum: ${bd.momentum.total}/25\n` +
      `🕵️ Deployer: ${bd.deployer.total}/20\n`
    if (bd.socialBonus > 0) body += `✨ Social: +${bd.socialBonus}\n`
  }

  // Use Markdown V1 — escape sparingly
  body += `\n[Deep dive](${APP_URL}/tokens/${mint})`

  const live = await fetchPrice(mint)
  if (live) body += `\nCurrent price: $${live.toPrecision(4)}`

  return { text: body, parseMode: 'Markdown' }
}

async function handleWallets(): Promise<CommandResponse> {
  const { data } = await supabaseAdmin
    .from('tracked_wallets')
    .select('label, address, win_rate')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!data || data.length === 0) {
    return { text: '📭 No wallets tracked yet. Add some at /wallets.' }
  }

  const wallets = data as Pick<TrackedWallet, 'label' | 'address' | 'win_rate'>[]

  const lines = wallets.map((w) => {
    const wr = w.win_rate != null ? `${(w.win_rate * 100).toFixed(0)}%` : '—'
    return `🐋 *${w.label ?? w.address.slice(0, 6) + '…'}* · win rate ${wr}`
  })

  return {
    text: `*Tracked Wallets* (${wallets.length})\n\n${lines.join('\n')}\n\n[Manage](${APP_URL}/wallets)`,
    parseMode: 'Markdown',
  }
}

async function handleMute(arg: string | undefined): Promise<CommandResponse> {
  const hours = arg ? parseFloat(arg) : 1
  if (isNaN(hours) || hours <= 0 || hours > 168) {
    return { text: '⚠️ Usage: `/mute [hours]` — hours must be 0–168 (1 week max)', parseMode: 'Markdown' }
  }

  const seconds = Math.round(hours * 3600)
  await muteAlerts(seconds)

  return {
    text: `🔕 Alerts muted for *${hours}* hour${hours === 1 ? '' : 's'}.\nUse /unmute to resume early.`,
    parseMode: 'Markdown',
  }
}

async function handleUnmute(): Promise<CommandResponse> {
  await unmuteAlerts()
  return { text: '🔔 Alerts resumed.' }
}
