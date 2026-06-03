// src/app/matches/page.tsx — All Matches, editorial theme.
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Signal, Surface } from '@/types'
import { Container, Card, SectionLabel, SignalPill, EdgePill, SurfaceTag, ProbSplit, C, mono, serif } from '@/components/editorial/ui'
import { SURFACE } from '@/lib/editorial/theme'

const selectStyle = {
  ...mono,
  fontSize: 11,
  color: C.body,
  background: C.paper,
  border: `1px solid ${C.line2}`,
  borderRadius: 3,
  padding: '5px 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [surfaceFilter, setSurfaceFilter] = useState('all')
  const [signalFilter, setSignalFilter] = useState('all')

  useEffect(() => {
    const params = new URLSearchParams({ status: 'SCHEDULED' })
    if (surfaceFilter !== 'all') params.set('surface', surfaceFilter)
    if (signalFilter !== 'all') params.set('signal', signalFilter)

    setLoading(true)
    fetch(`/api/matches?${params}`)
      .then(r => r.json())
      .then(d => { setMatches(d.matches || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [surfaceFilter, signalFilter])

  const signalCounts = { BET: 0, LEAN: 0, PASS: 0 }
  matches.forEach(m => { if (m.signal) signalCounts[m.signal as Signal]++ })

  return (
    <Container>
      {/* Lede */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>RallyIQ · The Full Slate</div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>Today&rsquo;s matches</h1>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <select value={surfaceFilter} onChange={e => setSurfaceFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Surfaces</option>
          <option value="Hard">Hard</option>
          <option value="Clay">Clay</option>
          <option value="Grass">Grass</option>
        </select>
        <select value={signalFilter} onChange={e => setSignalFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Signals</option>
          <option value="BET">BET only</option>
          <option value="LEAN">LEAN only</option>
          <option value="PASS">PASS only</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 6 }}>
          <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.green }}>{signalCounts.BET} BET</span>
          <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.gold }}>{signalCounts.LEAN} LEAN</span>
          <span style={{ ...mono, fontSize: 10, letterSpacing: 1, color: C.faint }}>{matches.length} TOTAL</span>
        </div>
      </div>

      <SectionLabel>Today&rsquo;s Matches</SectionLabel>

      {loading ? (
        <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '40px 0' }}>Loading matches&hellip;</div>
      ) : matches.length === 0 ? (
        <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '40px 0' }}>No matches found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matches.map(m => {
            const acc = (SURFACE[m.surface as string] ?? SURFACE.Hard).accent
            return (
              <Link key={m.id} href={`/matches/${m.id}`} style={{ textDecoration: 'none' }}>
                <Card accentRail={m.signal === 'PASS' ? undefined : acc} style={{ padding: 16 }}>
                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ ...mono, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.tournament?.slice(0, 14)}</span>
                    <SurfaceTag surface={m.surface as Surface} />
                    <span style={{ ...mono, fontSize: 10, color: C.faint }}>{m.round}</span>
                    <span style={{ ...mono, fontSize: 10, color: C.faint }}>BO{m.bestOf}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <EdgePill edge={m.edge1 ?? 0} />
                      <SignalPill signal={m.signal as Signal} />
                    </span>
                  </div>

                  {/* Players */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.ink }}>{m.player1?.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>
                        Elo {m.player1?.eloOverall?.toFixed(0)} · #{m.player1?.currentRank ?? '—'}
                      </div>
                    </div>
                    <span style={{ ...serif, fontSize: 13, fontStyle: 'italic', color: C.faint }}>vs</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.ink }}>{m.player2?.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>
                        Elo {m.player2?.eloOverall?.toFixed(0)} · #{m.player2?.currentRank ?? '—'}
                      </div>
                    </div>
                  </div>

                  <ProbSplit prob1={m.modelProb1 ?? 0.5} name1={m.player1?.name} name2={m.player2?.name} accent={acc} />

                  {/* Model vs market line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, ...mono, fontSize: 10, color: C.faint }}>
                    <span>Model <span style={{ color: C.green, fontWeight: 700 }}>{((m.modelProb1 ?? 0.5) * 100).toFixed(1)}%</span></span>
                    <span>Implied {((m.impliedProb1 ?? 0.5) * 100).toFixed(1)}%</span>
                    <span>Fair {m.fairOdds1} ({m.fairOddsAmerican1})</span>
                    <span>Mkt <span style={{ color: acc, fontWeight: 700 }}>{m.marketOdds1}</span></span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </Container>
  )
}
