// src/app/players/[id]/page.tsx
//
// `id` is `${tour}-${player_id}` — atp-206173, wta-211768. The tour belongs in
// the URL rather than a query param because player_id alone is ambiguous:
// Sackmann's ATP and WTA id spaces overlap on five ids, so 211768 is both Naomi
// Osaka and Manas Dhamne. A ?tour= param would leave the canonical URL
// ambiguous and make the collision silent again.

import { notFound } from 'next/navigation'
import { Container, Card, SectionLabel, Stat, SurfaceTag, FormStrip, C, mono, serif } from '@/components/editorial/ui'
import { MatchCard } from '@/components/editorial/MatchCard'
import { ResultsTable } from '@/components/editorial/ResultsTable'
import { getPlayer } from '@/lib/data/duckdb'
import { getIndexPlayer, loadIndex, playerNames, playerResults } from '@/lib/data/season'
import { slateForPlayer } from '@/lib/data/slate'

export const dynamic = 'force-dynamic'

function parseId(raw: string): { tour: 'ATP' | 'WTA'; playerId: string } | null {
  const m = /^(atp|wta)-(.+)$/i.exec(decodeURIComponent(raw))
  if (!m) return null
  return { tour: m[1].toUpperCase() as 'ATP' | 'WTA', playerId: m[2] }
}

function safeForm(json: string | undefined): number[] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.map(Number).filter(n => n === 0 || n === 1) : []
  } catch {
    return []
  }
}

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const parsed = parseId(params.id)
  if (!parsed) notFound()

  const rating = await getPlayer(parsed.tour, parsed.playerId)
  if (!rating) notFound()

  const id = `${parsed.tour.toLowerCase()}-${parsed.playerId}`
  const indexed = getIndexPlayer(id)
  const results = playerResults(id)
  const players = playerNames()
  const upcoming = await slateForPlayer(parsed.tour, parsed.playerId)

  const tournamentNames = new Map(loadIndex().tournaments.map(t => [t.slug, t.name]))
  const wins = results.filter(r => r.w === id).length
  const losses = results.length - wins

  const surfaces: Array<[string, number]> = [
    ['Hard', rating.elo_hard],
    ['Clay', rating.elo_clay],
    ['Grass', rating.elo_grass],
  ]

  return (
    <Container>
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>
          RallyIQ · The Player · {rating.tour}
        </div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>
          {rating.name}
        </h1>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Stat
            label="Rank"
            // ESPN caps its rankings feed at 150 per tour, so most of the field
            // legitimately has none. An em dash beats a fabricated number.
            value={rating.current_rank ? `#${rating.current_rank}` : '—'}
            sub={rating.current_rank ? undefined : 'outside the top 150'}
          />
          <Stat label="Elo" value={rating.elo_overall.toFixed(0)} sub={`${rating.matches_played} matches rated`} />
          <Stat
            label="2026 record"
            value={`${wins}–${losses}`}
            sub={results.length ? `${Math.round((wins / results.length) * 100)}% won` : 'no matches this season'}
          />
          <Stat
            label="Form"
            value={
              safeForm(rating.form_json).length ? (
                <span style={{ display: 'inline-block', paddingTop: 8 }}>
                  <FormStrip form={safeForm(rating.form_json)} />
                </span>
              ) : (
                '—'
              )
            }
            sub="last 10"
          />
        </div>
      </Card>

      <Card style={{ marginBottom: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, alignItems: 'start' }}>
          {surfaces.map(([s, elo]) => (
            <Stat
              key={s}
              label={s}
              value={elo.toFixed(0)}
              sub={<SurfaceTag surface={s} />}
              valueColor={elo === 1500 ? C.faint : C.ink}
            />
          ))}
          <Stat label="Hold" value={`${(rating.hold_pct * 100).toFixed(0)}%`} />
          <Stat label="Break" value={`${(rating.break_pct * 100).toFixed(0)}%`} />
        </div>
        {surfaces.some(([, e]) => e === 1500) && (
          <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 14 }}>
            A surface still at 1500 means no rated matches on it — not a rating of 1500.
          </div>
        )}
      </Card>

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <SectionLabel right={`${upcoming.length} scheduled`}>On the board</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(m => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel right={indexed ? `${results.length} matches` : undefined}>2026 match log</SectionLabel>
        <ResultsTable
          results={results}
          players={players}
          perspective={id}
          showTournament
          tournamentNames={tournamentNames}
        />
      </div>
    </Container>
  )
}
