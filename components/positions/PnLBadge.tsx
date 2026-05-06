interface Props {
  pnlPct: number | null
}

export function PnLBadge({ pnlPct }: Props) {
  if (pnlPct === null) {
    return <span className="text-[#444] text-sm tabular-nums">—</span>
  }

  const isPositive = pnlPct >= 0
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400'
  const prefix = isPositive ? '+' : ''

  return (
    <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
      {prefix}{pnlPct.toFixed(1)}%
    </span>
  )
}
