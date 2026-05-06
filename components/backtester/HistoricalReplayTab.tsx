export function HistoricalReplayTab() {
  return (
    <div className="text-center py-16">
      <p className="text-[#333] text-sm mb-2">Historical Replay</p>
      <p className="text-[#222] text-xs max-w-sm mx-auto">
        Replay will be enabled once SolBeam has collected 7+ days of token launch data in the{' '}
        <code className="font-mono text-[#333]">score_history</code> table.
        Until then, use the Forward Test tab to calibrate your signal thresholds.
      </p>
    </div>
  )
}
