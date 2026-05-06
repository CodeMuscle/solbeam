'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Live Feed', icon: '🔴' },
  { href: '/wallets', label: 'Smart Wallets', icon: '🐋' },
  { href: '/positions', label: 'Positions', icon: '📍' },
  { href: '/backtester', label: 'Backtester', icon: '🧪' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-[#0d0d0d] border-r border-[#1e1e1e] flex flex-col z-50">
      <div className="px-5 py-5 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-xl">🔆</span>
          <span className="text-white font-semibold text-base tracking-tight">SolBeam</span>
        </div>
        <p className="text-[#444] text-xs mt-1">Solana Intel Dashboard</p>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-[#1a1a1a] text-white border border-[#2a2a2a]'
                  : 'text-[#666] hover:text-[#aaa] hover:bg-[#141414]'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[#1e1e1e]">
        <p className="text-[#2a2a2a] text-xs font-mono">v1.0.0-alpha</p>
      </div>
    </aside>
  )
}
