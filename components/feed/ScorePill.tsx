import { scoreToColor } from '@/lib/feed-utils'

interface Props {
  score: number
  size?: 'sm' | 'md'
}

export function ScorePill({ score, size = 'md' }: Props) {
  const colorClass = scoreToColor(score)
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'

  return (
    <span className={`inline-flex items-center font-mono font-semibold rounded-full border ${colorClass} ${sizeClass}`}>
      {score}
    </span>
  )
}
