// src/components/layout/TopBar.tsx
'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/matches':   'Match Center',
  '/rankings':  'Player Rankings',
  '/bankroll':  'Bankroll Tracker',
  '/backtest':  'Results & Backtest',
  '/settings':  'Settings',
}

export function TopBar() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'RallyIQ'
  const now = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const [refreshing, setRefreshing] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Poll status on mount
  useEffect(() => {
    fetch('/api/refresh')
      .then(r => r.json())
      .then(d => {
        if (d.matchCount != null) setMatchCount(d.matchCount)
        if (d.lastUpdated) {
          const t = new Date(d.lastUpdated)
          setLastUpdated(t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
        }
      })
      .catch(() => {})
  }, [])

  async function triggerRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const res = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'rallyiq2026' }) })
      const data = await res.json()
      if (data.ok) {
        setMatchCount(data.matchCount)
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
        // Reload the page so new match data is visible
        window.location.reload()
      } else {
        setRefreshError('Refresh failed')
      }
    } catch {
      setRefreshError('Network error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-terminal-border bg-terminal-surface shrink-0 gap-4">
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="font-mono font-bold text-lg text-white tracking-wide">
          RALLY<span className="text-blue">IQ</span>
        </h1>
        <span className="text-terminal-muted">|</span>
        <span className="text-sm text-white/90 font-mono uppercase tracking-widest hidden sm:block">{title}</span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Match count + last updated */}
        {matchCount !== null && (
          <span className="font-mono text-xs text-white/90 hidden md:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            {matchCount} matches
            {lastUpdated && <span className="text-terminal-text">· {lastUpdated}</span>}
          </span>
        )}

        {/* Refresh button */}
        <button
          onClick={triggerRefresh}
          disabled={refreshing}
          title="Fetch today's matches"
          className={`
            flex items-center gap-1.5 font-mono text-2xs px-2 py-1
            border border-terminal-border rounded
            transition-colors
            ${refreshing
              ? 'text-terminal-dim cursor-wait'
              : 'text-terminal-muted hover:text-green hover:border-green/40 cursor-pointer'
            }
          `}
        >
          <RefreshCw
            size={13}
            className={refreshing ? 'animate-spin' : ''}
          />
          <span className="hidden sm:inline">{refreshing ? 'Fetching...' : 'Refresh'}</span>
        </button>

        {refreshError && (
          <span className="font-mono text-2xs text-red hidden sm:block">{refreshError}</span>
        )}

        <span className="font-mono text-xs text-white/80 hidden lg:block">{now}</span>
      </div>
    </header>
  )
}
