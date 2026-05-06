import type { Token } from '@/lib/types'
import { TierBadge } from '@/components/feed/TierBadge'

interface Props {
  tokens: Pick<Token, 'mint' | 'symbol' | 'tier' | 'created_at'>[]
  deployerAddress: string | null
}

export function DeployerHistory({ tokens, deployerAddress }: Props) {
  if (!deployerAddress) {
    return (
      <div className="text-[#333] text-sm py-4 text-center">Deployer address unknown</div>
    )
  }

  return (
    <div>
      <p className="text-[#444] text-xs font-mono mb-3 truncate">{deployerAddress}</p>
      {tokens.length === 0 ? (
        <p className="text-[#333] text-sm">No previous tokens found for this deployer.</p>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div key={token.mint} className="flex items-center gap-3">
              <span className="text-[#666] text-xs font-semibold w-16 truncate">
                {token.symbol ?? token.mint.slice(0, 6)}
              </span>
              <TierBadge tier={token.tier} />
              <span className="text-[#333] text-xs ml-auto">
                {new Date(token.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
