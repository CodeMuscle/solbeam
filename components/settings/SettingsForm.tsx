'use client'

import { useState } from 'react'
import { WeightSliders } from './WeightSliders'
import { KeywordEditor } from './KeywordEditor'
import { TelegramConfig } from './TelegramConfig'
import type { Settings } from '@/lib/types'

interface Props {
  initialSettings: Settings
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-4">
      <h3 className="text-[#555] text-xs uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function SettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weightTotal = Object.values(settings.signal_weights).reduce((s, v) => s + v, 0)
  const weightsValid = Math.abs(weightTotal - 100) < 0.01

  async function handleSave() {
    if (!weightsValid) return
    setSaving(true)
    setError(null)

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal_weights: settings.signal_weights,
        social_signal_enabled: settings.social_signal_enabled,
        narrative_keywords: settings.narrative_keywords,
        min_alert_score: settings.min_alert_score,
        take_profit_tiers: settings.take_profit_tiers,
        stop_loss_pct: settings.stop_loss_pct,
        break_even_fee_pct: settings.break_even_fee_pct,
        telegram_bot_token: settings.telegram_bot_token,
        telegram_chat_id: settings.telegram_chat_id,
        data_retention_days: settings.data_retention_days,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <Section title="Signal Weights">
        <WeightSliders
          weights={settings.signal_weights}
          onChange={(w) => setSettings((s) => ({ ...s, signal_weights: w }))}
        />
      </Section>

      <Section title="Social & Narrative Signal">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[#888] text-sm flex-1">Enable social bonus (+0–5 pts)</span>
          <button
            onClick={() =>
              setSettings((s) => ({ ...s, social_signal_enabled: !s.social_signal_enabled }))
            }
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.social_signal_enabled ? 'bg-green-500/40' : 'bg-[#1a1a1a]'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform bg-white ${
                settings.social_signal_enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <KeywordEditor
          keywords={settings.narrative_keywords}
          onChange={(kw) => setSettings((s) => ({ ...s, narrative_keywords: kw }))}
        />
      </Section>

      <Section title="Alert Thresholds">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Min alert score', key: 'min_alert_score' as const, min: 0, max: 100, step: 5 },
            { label: 'Stop-loss %', key: 'stop_loss_pct' as const, min: 0, max: 90, step: 5 },
            { label: 'Break-even fee %', key: 'break_even_fee_pct' as const, min: 0, max: 2, step: 0.1 },
            { label: 'Data retention (days)', key: 'data_retention_days' as const, min: 7, max: 90, step: 7 },
          ].map(({ label, key, min, max, step }) => (
            <div key={key}>
              <label className="block text-[#555] text-xs mb-1">{label}</label>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={settings[key] as number}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))
                }
                className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-sm rounded px-3 py-2 outline-none focus:border-[#2a2a2a] tabular-nums"
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-[#555] text-xs mb-1">
            Take-profit tiers (comma-separated multipliers)
          </label>
          <input
            type="text"
            value={settings.take_profit_tiers.join(', ')}
            onChange={(e) => {
              const parsed = e.target.value
                .split(',')
                .map((s) => parseFloat(s.trim()))
                .filter((n) => !isNaN(n))
              setSettings((s) => ({ ...s, take_profit_tiers: parsed }))
            }}
            placeholder="1.5, 3.0, 10.0"
            className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-sm rounded px-3 py-2 outline-none focus:border-[#2a2a2a] font-mono"
          />
          <p className="text-[#333] text-xs mt-1">
            Default: 1.5 (moderate), 3.0 (runner), 10.0 (moonshot)
          </p>
        </div>
      </Section>

      <Section title="Telegram Alerts">
        <TelegramConfig
          botToken={settings.telegram_bot_token ?? ''}
          chatId={settings.telegram_chat_id ?? ''}
          onChangeBotToken={(v) => setSettings((s) => ({ ...s, telegram_bot_token: v || null }))}
          onChangeChatId={(v) => setSettings((s) => ({ ...s, telegram_chat_id: v || null }))}
        />
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !weightsValid}
          className="text-sm px-5 py-2 rounded border border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-400 text-xs">✓ Saved</span>}
        {error && <span className="text-red-400 text-xs">{error}</span>}
        {!weightsValid && (
          <span className="text-amber-400 text-xs">
            Signal weights must sum to 100 (currently {weightTotal})
          </span>
        )}
      </div>
    </div>
  )
}
