interface Holder {
  address: string
  pct: number
  walletAge?: number
  label?: string
}

interface Props {
  holders: Holder[]
}

export function HolderTable({ holders }: Props) {
  if (holders.length === 0) {
    return (
      <div className="text-[#333] text-sm py-4 text-center">
        Holder data not available
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            {['#', 'Address', 'Hold %', 'Label'].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-[#444] font-medium uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holders.map((holder, i) => (
            <tr key={holder.address} className="border-b border-[#0f0f0f]">
              <td className="px-3 py-2 text-[#444]">{i + 1}</td>
              <td className="px-3 py-2 font-mono text-[#666]">
                {holder.address.slice(0, 6)}…{holder.address.slice(-4)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                <span
                  className={`${
                    holder.pct > 20 ? 'text-red-400' : holder.pct > 10 ? 'text-amber-400' : 'text-[#666]'
                  }`}
                >
                  {holder.pct.toFixed(2)}%
                </span>
              </td>
              <td className="px-3 py-2 text-[#444]">
                {holder.label ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
