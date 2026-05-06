import { tierToColor, tierToLabel } from '@/lib/feed-utils'
import type { OutcomeTier } from '@/lib/types'

interface Props {
  tier: OutcomeTier | null
}

export function TierBadge({ tier }: Props) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border ${tierToColor(tier)}`}>
      {tierToLabel(tier)}
    </span>
  )
}
