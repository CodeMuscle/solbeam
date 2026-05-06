import type { TokenSource } from '@/lib/types'

const sourceConfig: Record<TokenSource, { label: string; className: string }> = {
  pump_fun: { label: 'Pump.fun', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  raydium: { label: 'Raydium', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  trending: { label: 'Trending', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
}

interface Props { source: TokenSource }

export function SourceBadge({ source }: Props) {
  const config = sourceConfig[source]
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${config.className}`}>
      {config.label}
    </span>
  )
}
