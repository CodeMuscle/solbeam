import type { SignalWeights } from '@/lib/types'

interface Props {
  weights: SignalWeights
  onChange: (weights: SignalWeights) => void
}

const categories: Array<{ key: keyof SignalWeights; label: string; color: string }> = [
  { key: 'smart_money', label: '🐋 Smart Money', color: 'accent-blue-400' },
  { key: 'token_health', label: '🔒 Token Health', color: 'accent-green-400' },
  { key: 'momentum', label: '📈 Momentum', color: 'accent-amber-400' },
  { key: 'deployer', label: '🕵️ Deployer', color: 'accent-purple-400' },
]

export function WeightSliders({ weights, onChange }: Props) {
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  const isValid = Math.abs(total - 100) < 0.01

  function handleChange(key: keyof SignalWeights, value: number) {
    onChange({ ...weights, [key]: value })
  }

  return (
    <div>
      {categories.map(({ key, label, color }) => (
        <div key={key} className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#888] text-sm">{label}</span>
            <span className="text-[#ccc] text-sm tabular-nums font-mono w-8 text-right">
              {weights[key]}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={weights[key]}
            onChange={(e) => handleChange(key, Number(e.target.value))}
            className={`w-full ${color}`}
          />
        </div>
      ))}

      <div
        className={`flex items-center justify-between text-xs mt-4 pt-3 border-t border-[#1a1a1a] ${
          isValid ? 'text-[#444]' : 'text-red-400'
        }`}
      >
        <span>Total</span>
        <span className="font-mono tabular-nums">
          {total} / 100 {isValid ? '✓' : '⚠ Must equal 100'}
        </span>
      </div>
    </div>
  )
}
