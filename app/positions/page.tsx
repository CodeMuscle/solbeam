import { PositionTracker } from '@/components/positions/PositionTracker'

export const dynamic = 'force-dynamic'

export default async function PositionsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000'

  let positions = []
  try {
    const res = await fetch(`${baseUrl}/api/positions`, { cache: 'no-store' })
    if (res.ok) positions = await res.json()
  } catch {
    // Positions empty on first load if API unreachable
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-white font-semibold text-lg">Positions</h1>
          <p className="text-[#444] text-xs mt-0.5">
            Track paper and real trades · Exit monitor runs every minute
          </p>
        </div>
      </div>

      <PositionTracker initialPositions={positions} />
    </div>
  )
}
