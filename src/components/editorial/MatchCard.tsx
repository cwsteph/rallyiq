// src/components/editorial/MatchCard.tsx
// The slate card, lifted out of app/matches/page.tsx so the tournament and
// player pages show an upcoming match the same way the matches desk does.
// Server-safe: no hooks.

import Link from 'next/link'
import { Card, SurfaceTag, EdgePill, SignalPill, ProbSplit, C, mono, serif } from './ui'
import { SURFACE } from '@/lib/editorial/theme'
import type { EnrichedMatch } from '@/lib/data/slate'
import type { Signal, Surface } from '@/types'

export function MatchCard({ m, showTournament = true }: { m: EnrichedMatch; showTournament?: boolean }) {
  const acc = (SURFACE[m.surface as string] ?? SURFACE.Hard).accent
  return (
    <Link href={`/matches/${m.id}`} style={{ textDecoration: 'none' }}>
      <Card accentRail={m.signal === 'PASS' ? undefined : acc} style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {showTournament && (
            <span style={{ ...mono, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {m.tournament}
            </span>
          )}
          <SurfaceTag surface={m.surface as Surface} />
          <span style={{ ...mono, fontSize: 10, color: C.faint }}>{m.round}</span>
          <span style={{ ...mono, fontSize: 10, color: C.faint }}>BO{m.bestOf}</span>
          {m.scheduledTime && <span style={{ ...mono, fontSize: 10, color: C.faint }}>{m.scheduledTime}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EdgePill edge={m.edge1 ?? 0} />
            <SignalPill signal={m.signal as Signal} />
          </span>
        </div>

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, ...mono, fontSize: 10, color: C.faint }}>
          <span>Model <span style={{ color: C.green, fontWeight: 700 }}>{((m.modelProb1 ?? 0.5) * 100).toFixed(1)}%</span></span>
          <span>Implied {((m.impliedProb1 ?? 0.5) * 100).toFixed(1)}%</span>
          <span>Fair {m.fairOdds1} ({m.fairOddsAmerican1})</span>
          <span>Mkt <span style={{ color: acc, fontWeight: 700 }}>{m.marketOdds1}</span></span>
        </div>
      </Card>
    </Link>
  )
}
