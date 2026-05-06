import type { ScoreBucketStats } from '@/lib/backtester-stats'

interface Props {
  stats: ScoreBucketStats[]
  totalTrades: number
}

function WinRateBar({ rate }: { rate: number }) {
  const pct = rate * 100
  const color = pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-right text-[#888]">{pct.toFixed(0)}%</span>
    </div>
  )
}

export function ForwardTestReport({ stats, totalTrades }: Props) {
  if (totalTrades === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#333] text-sm">No closed paper trades yet.</p>
        <p className="text-[#222] text-xs mt-2">
          Open paper trades from the Live Feed and close them to build your performance report.
        </p>
      </div>
    )
  }

  const overallWins = stats.reduce((s, b) => s + Math.round(b.winRate * b.count), 0)
  const overallWinRate = totalTrades > 0 ? overallWins / totalTrades : 0
  const avgReturn = stats.length > 0
    ? stats.reduce((s, b) => s + b.avgReturnPct * b.count, 0) / totalTrades
    : 0

  const recommendedMin = stats.find((s) => s.winRate >= 0.6)?.bucket ?? 'Need more data'

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Trades', value: totalTrades.toString() },
          { label: 'Overall Win Rate', value: `${(overallWinRate * 100).toFixed(0)}%` },
          { label: 'Avg Return', value: `${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-lg p-4 text-center">
            <div className="text-[#444] text-xs mb-1">{label}</div>
            <div className="text-white text-xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 px-4 py-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-xs">
        <span className="text-[#444]">Recommended min score threshold: </span>
        <span className="text-green-400 font-semibold">{recommendedMin}</span>
        <span className="text-[#333] ml-2">(first bucket with win rate ≥ 60%)</span>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            {['Score Range', 'Trades', 'Win Rate', 'Avg Return', 'Best', 'Worst'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-[#444] font-medium uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.bucket} className="border-b border-[#0f0f0f]">
              <td className="px-4 py-3 font-mono text-[#888]">{row.bucket}</td>
              <td className="px-4 py-3 text-[#666] tabular-nums">{row.count}</td>
              <td className="px-4 py-3 w-40">
                <WinRateBar rate={row.winRate} />
              </td>
              <td className="px-4 py-3 tabular-nums">
                <span className={row.avgReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {row.avgReturnPct >= 0 ? '+' : ''}{row.avgReturnPct.toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-3 text-green-400 tabular-nums">+{row.bestTrade.toFixed(1)}%</td>
              <td className="px-4 py-3 text-red-400 tabular-nums">{row.worstTrade.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
