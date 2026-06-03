// src/app/rankings/page.tsx — Player Rankings, editorial theme.
'use client'
import { useState, useEffect } from 'react'
import { Container, Card, SectionLabel, FormStrip, C, BRAND, serif, sans, mono } from '@/components/editorial/ui'

export default function RankingsPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tour, setTour] = useState('ATP')
  const [surface, setSurface] = useState('overall')
  const [sortBy, setSortBy] = useState('eloOverall')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/players?tour=${tour}&surface=${surface}&sortBy=${sortBy}`)
      .then(r => r.json())
      .then(d => { setPlayers(d.players || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tour, surface, sortBy])

  const surfaceLabel = surface === 'hard' ? 'Hard' : surface === 'clay' ? 'Clay' : surface === 'grass' ? 'Grass' : 'Overall'

  const columns = [
    { key: '', label: '#', w: '40px', align: 'left' as const },
    { key: 'name', label: 'Player', w: 'auto', align: 'left' as const },
    { key: 'currentRank', label: 'Rank', w: '64px', align: 'right' as const },
    { key: 'eloOverall', label: 'Elo', w: '72px', align: 'right' as const },
    { key: 'surfaceElo', label: `${surfaceLabel} Elo`, w: '88px', align: 'right' as const },
    { key: 'form', label: 'Form', w: '96px', align: 'left' as const },
    { key: 'holdPct', label: 'Hold%', w: '72px', align: 'right' as const },
    { key: 'breakPct', label: 'Break%', w: '76px', align: 'right' as const },
    { key: 'fairOdds', label: 'Fair Odds', w: '84px', align: 'right' as const },
  ]

  return (
    <Container>
      {/* Lede */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>RallyIQ · The Rankings</div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>Player rankings</h1>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {(['ATP', 'WTA'] as const).map(t => {
          const active = tour === t
          return (
            <button
              key={t}
              onClick={() => setTour(t)}
              style={{
                ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
                color: active ? C.paper : C.muted,
                background: active ? BRAND : C.paper,
                border: `1px solid ${active ? BRAND : C.line2}`,
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          )
        })}
        <select
          value={surface}
          onChange={e => setSurface(e.target.value)}
          style={{
            ...mono, fontSize: 11, color: C.body, background: C.paper,
            border: `1px solid ${C.line2}`, borderRadius: 3, padding: '6px 10px', marginLeft: 6, cursor: 'pointer',
          }}
        >
          <option value="overall">Overall Elo</option>
          <option value="hard">Hard Elo</option>
          <option value="clay">Clay Elo</option>
          <option value="grass">Grass Elo</option>
        </select>
        <span style={{ ...mono, fontSize: 10, letterSpacing: 0.5, color: C.faint, marginLeft: 'auto' }}>{players.length} players</span>
      </div>

      <SectionLabel>Player Rankings — {tour} · {surfaceLabel}</SectionLabel>

      {loading ? (
        <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '40px 0' }}>Loading rankings…</div>
      ) : (
        <Card style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line2}` }}>
                {columns.map(col => {
                  const sorted = sortBy === col.key && col.key !== ''
                  return (
                    <th
                      key={col.key}
                      onClick={() => col.key && setSortBy(col.key)}
                      style={{
                        ...mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600,
                        textAlign: col.align, padding: '12px 14px', width: col.w,
                        color: sorted ? BRAND : C.faint,
                        cursor: col.key ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}{sorted ? ' ↓' : ''}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const surfHigher = p.surfaceElo > p.eloOverall
                const surfLower = p.surfaceElo < p.eloOverall
                const surfColor = surfHigher ? C.green : surfLower ? C.gold : C.ink
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: `1px solid ${C.line}`,
                      background: i % 2 === 1 ? 'rgba(29,26,21,0.018)' : C.paper,
                    }}
                  >
                    <td style={{ ...mono, fontSize: 10, color: C.faint, padding: '11px 14px' }}>{i + 1}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ ...serif, fontSize: 15, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: 0.5, color: C.faint, textTransform: 'uppercase', marginTop: 1 }}>{p.nationality}</div>
                    </td>
                    <td style={{ ...mono, fontSize: 12, color: C.muted, padding: '11px 14px', textAlign: 'right' }}>
                      {p.currentRank ? `#${p.currentRank}` : '—'}
                    </td>
                    <td style={{ ...mono, fontSize: 12, fontWeight: 600, color: C.ink, padding: '11px 14px', textAlign: 'right' }}>
                      {p.eloOverall.toFixed(0)}
                    </td>
                    <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: surfColor, padding: '11px 14px', textAlign: 'right' }}>
                      {p.surfaceElo?.toFixed(0) ?? '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {Array.isArray(p.form10) && p.form10.length > 0
                        ? <FormStrip form={p.form10} />
                        : <span style={{ ...mono, fontSize: 12, color: C.faint }}>—</span>}
                    </td>
                    <td style={{ ...mono, fontSize: 12, color: C.body, padding: '11px 14px', textAlign: 'right' }}>
                      {p.holdPct ? `${(p.holdPct * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ ...mono, fontSize: 12, color: C.body, padding: '11px 14px', textAlign: 'right' }}>
                      {p.breakPct ? `${(p.breakPct * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: BRAND, padding: '11px 14px', textAlign: 'right' }}>
                      {p.fairOdds?.toFixed(2) ?? '—'}
                    </td>
                  </tr>
                )
              })}
              {players.length === 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '40px 0' }}>
                    No players loaded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </Container>
  )
}
