import { supabaseAdmin } from '@/lib/supabase/admin'
import { SettingsForm } from '@/components/settings/SettingsForm'
import type { Settings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  signal_weights: { smart_money: 30, token_health: 25, momentum: 25, deployer: 20 },
  social_signal_enabled: true,
  narrative_keywords: ['AI', 'TRUMP', 'DOG', 'PEPE', 'RWA', 'MEME', 'CAT'],
  min_alert_score: 70,
  take_profit_tiers: [1.5, 3.0, 10.0],
  stop_loss_pct: 30,
  break_even_fee_pct: 0.5,
  telegram_bot_token: null,
  telegram_chat_id: null,
  data_retention_days: 30,
}

export default async function SettingsPage() {
  const { data } = await supabaseAdmin.from('settings').select('*').eq('id', 1).single()
  const settings = (data as Settings) ?? DEFAULT_SETTINGS

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-white font-semibold text-lg">Settings</h1>
        <p className="text-[#444] text-xs mt-0.5">
          Configure signal weights, alert thresholds, and integrations
        </p>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  )
}
