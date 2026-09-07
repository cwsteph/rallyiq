// src/app/tournaments/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Container, Card, SectionLabel, Stat, SurfaceTag, C, mono, serif } from '@/components/editorial/ui'
import { MatchCard } from '@/components/editorial/MatchCard'
import { ResultsTable } from '@/components/editorial/ResultsTable'
import { SURFACE } from '@/lib/editorial/theme'
import { getTournament, playerNames, tournamentResults } from '@/lib/data/season'
import { slateForTournament } from '@/lib/data/slate'
import type { Surface } from '@/types'

export const dynamic = 'force-dynamic'

function fmtRange(start: string, end: string) {
  const f = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  // Pre-cutoff events come from the CSVs, whose tourney_date is the tournament's
  // start rather than each match's date. Showing one date is honest; inventing
  // a fortnight is not.
  return start === end ? f(start) : `${f(start)} – ${f(end)}`
}

export default async function TournamentPage({ params }: { params: { slug: string } }) {
  const t = getTournament(params.slug)
  if (!t) notFound()

  const results = tournamentResults(t.slug)
  const players = playerNames()
  const upcoming = await slateForTournament(t.slug)
  const acc = (SURFACE[t.surface ?? 'Hard'] ?? SURFACE.Hard).accent

  return (
    <Container>
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>
          RallyIQ · The Tournament
        </div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>
          {t.name}
        </h1>
      </div>

      <Card accentRail={acc} style={{ marginBottom: 26 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Stat
            label="Surface"
            value={t.surface ? <SurfaceTag surface={t.surface as Surface} /> : '—'}
          />
          <Stat label="Dates" value={<span style={{ fontSize: 22 }}>{fmtRange(t.start, t.end)}</span>} />
          <Stat label="Tour" value={<span style={{ fontSize: 22 }}>{t.tours.join(' + ')}</span>} />
          <Stat label="Matches" value={t.matches} sub={`${results.length} in the season index`} />
        </div>
      </Card>

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <SectionLabel accent={acc} right={`${upcoming.length} scheduled`}>
            On the board
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(m => (
              <MatchCard key={m.id} m={m} showTournament={false} />
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel accent={acc} right={`${results.length} played`}>
          Completed
        </SectionLabel>
        <ResultsTable results={results} players={players} />
      </div>
    </Container>
  )
}
