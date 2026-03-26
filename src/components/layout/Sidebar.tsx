// src/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Swords, BarChart3, DollarSign,
  FlaskConical, Settings, TrendingUp
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/matches',    label: 'Matches',    icon: Swords },
  { href: '/rankings',   label: 'Rankings',   icon: BarChart3 },
  { href: '/bankroll',   label: 'Bankroll',   icon: DollarSign },
  { href: '/backtest',   label: 'Backtest',   icon: FlaskConical },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-14 flex flex-col bg-terminal-surface border-r border-terminal-border shrink-0">
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b border-terminal-border">
        <span className="font-mono font-bold text-base text-green tracking-widest">RQ</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 p-2 pt-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`
                w-12 h-12 flex items-center justify-center rounded
                transition-colors duration-150 group relative
                ${active
                  ? 'bg-green-bg text-green'
                  : 'text-terminal-text hover:text-amber hover:bg-terminal-border/60'
                }
              `}
            >
              <Icon size={16} />
              {/* Tooltip */}
              <span className="
                absolute left-12 px-2 py-1 text-xs font-mono whitespace-nowrap
                bg-terminal-surface border border-terminal-border rounded
                text-terminal-text opacity-0 group-hover:opacity-100
                pointer-events-none transition-opacity z-50
              ">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-terminal-border">
        <Link
          href="/settings"
          title="Settings"
          className="w-12 h-12 flex items-center justify-center rounded text-terminal-muted hover:text-amber hover:bg-terminal-border transition-colors"
        >
          <Settings size={16} />
        </Link>
      </div>
    </aside>
  )
}
