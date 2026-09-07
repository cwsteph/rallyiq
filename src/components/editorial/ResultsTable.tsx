// src/components/editorial/ResultsTable.tsx
// Completed matches, in the zebra table idiom the rankings desk already uses.
// Server-safe: no hooks.

import Link from 'next/link'
import { Card, C, mono, serif } from './ui'
import type { IndexPlayer, IndexResult } from '@/lib/data/season'

const th: React.CSSProperties = {
  ...mono,
  fontSize: 9,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: C.faint,
  fontWeight: 600,
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: `1px solid ${C.line2}`,
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: `1px solid ${C.line}`,
  verticalAlign: 'middle',
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  return `${m}/${day}`
}

export function ResultsTable({
  results,
  players,
  /** Perspective player: their row shows W or L instead of a winner/loser pair. */
  perspective,
  showTournament = false,
  tournamentNames,
}: {
  results: IndexResult[]
  players: Map<string, IndexPlayer>
  perspective?: string
  showTournament?: boolean
  tournamentNames?: Map<string, string>
}) {
  if (!results.length) {
    return (
      <Card>
        <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '28px 0' }}>
          No completed matches recorded this season
        </div>
      </Card>
    )
  }

  const name = (id: string) => players.get(id)?.name ?? id

  return (
    <Card style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            {showTournament && <th style={th}>Tournament</th>}
            <th style={th}>Round</th>
            {perspective && <th style={th}>Result</th>}
            <th style={th}>{perspective ? 'Opponent' : 'Winner'}</th>
            {!perspective && <th style={th}>Loser</th>}
            <th style={th}>Score</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const won = perspective ? r.w === perspective : false
            const other = perspective ? (won ? r.l : r.w) : r.w
            return (
              <tr key={`${r.s}-${r.w}-${r.l}-${i}`} style={{ background: i % 2 ? 'rgba(29,26,21,0.018)' : 'transparent' }}>
                <td style={{ ...td, ...mono, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{fmtDate(r.d)}</td>
                {showTournament && (
                  <td style={{ ...td, ...mono, fontSize: 11 }}>
                    <Link href={`/tournaments/${r.s}`} style={{ color: C.body, textDecoration: 'none' }}>
                      {tournamentNames?.get(r.s) ?? r.s}
                    </Link>
                  </td>
                )}
                <td style={{ ...td, ...mono, fontSize: 10, color: C.faint, whiteSpace: 'nowrap' }}>{r.r}</td>
                {perspective && (
                  <td style={td}>
                    <span
                      style={{
                        ...mono,
                        fontSize: 10,
                        fontWeight: 700,
                        color: won ? C.green : C.red,
                        border: `1px solid ${won ? C.green : C.red}`,
                        borderRadius: 99,
                        padding: '1px 7px',
                      }}
                    >
                      {won ? 'W' : 'L'}
                    </span>
                  </td>
                )}
                <td style={td}>
                  <Link
                    href={`/players/${other}`}
                    style={{ ...serif, fontSize: 14, fontWeight: perspective ? 500 : 600, color: C.ink, textDecoration: 'none' }}
                  >
                    {name(other)}
                  </Link>
                </td>
                {!perspective && (
                  <td style={td}>
                    <Link href={`/players/${r.l}`} style={{ ...serif, fontSize: 14, color: C.muted, textDecoration: 'none' }}>
                      {name(r.l)}
                    </Link>
                  </td>
                )}
                <td style={{ ...td, ...mono, fontSize: 11, color: C.body, whiteSpace: 'nowrap' }}>{r.sc}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
