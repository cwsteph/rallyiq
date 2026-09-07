'use client'
// src/components/editorial/Masthead.tsx
// Global editorial chrome — replaces the dark sidebar + topbar. RallyIQ wordmark,
// section nav (active underlined in the brand accent), live match count and the
// timestamp of the last published refresh.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { C, BRAND, serif, mono } from '@/lib/editorial/theme'
import { SearchPalette } from './SearchPalette'

const NAV = [
  { href: '/',         label: 'Dashboard' },
  { href: '/matches',  label: 'Matches' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/bankroll', label: 'Bankroll' },
  { href: '/backtest', label: 'Backtest' },
]

export function Masthead() {
  const pathname = usePathname() ?? '/'

  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/refresh').then(r => r.json()).then(d => {
      if (d.matchCount != null) setMatchCount(d.matchCount)
      if (d.lastUpdated) setLastUpdated(new Date(d.lastUpdated).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }))
    }).catch(() => {})
  }, [])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <div style={{ borderBottom: `2px solid ${C.ink}`, background: C.paper }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link href="/" data-tour="brand" style={{ ...serif, fontWeight: 700, fontSize: 24, color: C.ink, letterSpacing: -0.5, textDecoration: 'none' }}>
          Rally<span style={{ color: BRAND }}>IQ</span>
        </Link>
        <div data-tour="nav" style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
          {NAV.map(n => {
            const active = isActive(n.href)
            return (
              <Link key={n.href} href={n.href} style={{ ...mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: active ? C.ink : C.faint, fontWeight: active ? 700 : 400, borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent', paddingBottom: 2, textDecoration: 'none' }}>
                {n.label}
              </Link>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <SearchPalette />
          {matchCount !== null && (
            <span style={{ ...mono, fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: C.green }} />
              {matchCount} matches
            </span>
          )}
          <button
            onClick={() => {
              const w = window as unknown as { startRallyTour?: () => void }
              if (pathname === '/' && typeof w.startRallyTour === 'function') w.startRallyTour()
              else {
                try { sessionStorage.setItem('rally_tour_pending', '1') } catch { /* ignore */ }
                window.location.href = '/'
              }
            }}
            title="Guided tour of RallyIQ"
            style={{ ...mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: BRAND, background: 'transparent', border: `1px solid ${BRAND}`, borderRadius: 3, padding: '5px 10px', cursor: 'pointer' }}
          >
            How it works
          </button>
          {/* Was a Refresh button posting to /api/refresh. Nothing a browser
              does can refresh this data — the daily GitHub Actions run commits
              it and Netlify rebuilds — so the control now states when that last
              happened instead of offering an action it cannot perform. */}
          <span
            data-tour="refresh"
            title="Published by the daily refresh workflow"
            style={{ ...mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, border: `1px solid ${C.line2}`, borderRadius: 3, padding: '5px 10px' }}
          >
            {lastUpdated ? `Updated ${lastUpdated}` : 'Updated —'}
          </span>
        </div>
      </div>
    </div>
  )
}
