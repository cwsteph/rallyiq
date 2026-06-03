'use client'
// src/components/editorial/Masthead.tsx
// Global editorial chrome — replaces the dark sidebar + topbar. RallyIQ wordmark,
// section nav (active underlined in the brand accent), live match count + refresh.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { C, BRAND, serif, mono } from '@/lib/editorial/theme'

const NAV = [
  { href: '/',         label: 'Dashboard' },
  { href: '/matches',  label: 'Matches' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/bankroll', label: 'Bankroll' },
  { href: '/backtest', label: 'Backtest' },
]

export function Masthead() {
  const pathname = usePathname() ?? '/'
  const now = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const [refreshing, setRefreshing] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/refresh').then(r => r.json()).then(d => {
      if (d.matchCount != null) setMatchCount(d.matchCount)
      if (d.lastUpdated) setLastUpdated(new Date(d.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    }).catch(() => {})
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'rallyiq2026' }) })
      const data = await res.json()
      if (data.ok) { setMatchCount(data.matchCount); window.location.reload() }
    } finally { setRefreshing(false) }
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <div style={{ borderBottom: `2px solid ${C.ink}`, background: C.paper }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link href="/" style={{ ...serif, fontWeight: 700, fontSize: 24, color: C.ink, letterSpacing: -0.5, textDecoration: 'none' }}>
          Rally<span style={{ color: BRAND }}>IQ</span>
        </Link>
        <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
          {NAV.map(n => {
            const active = isActive(n.href)
            return (
              <Link key={n.href} href={n.href} style={{ ...mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: active ? C.ink : C.faint, fontWeight: active ? 700 : 400, borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent', paddingBottom: 2, textDecoration: 'none' }}>
                {n.label}
              </Link>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {matchCount !== null && (
            <span style={{ ...mono, fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: C.green }} />
              {matchCount} matches{lastUpdated ? ` · ${lastUpdated}` : ''}
            </span>
          )}
          <button onClick={refresh} disabled={refreshing} style={{ ...mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: refreshing ? C.faint : C.ink, background: 'transparent', border: `1px solid ${C.line2}`, borderRadius: 3, padding: '5px 10px', cursor: refreshing ? 'wait' : 'pointer' }}>
            {refreshing ? 'Fetching…' : 'Refresh'}
          </button>
          <span style={{ ...mono, fontSize: 10, color: C.faint }}>{now}</span>
        </div>
      </div>
    </div>
  )
}
