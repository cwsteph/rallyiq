// src/app/page.tsx — Dashboard ("Today's Board"), editorial theme.
import { getTodayMatches } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability } from '@/lib/model/probability'
import { computeEdge } from '@/lib/betting/edge'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import type { Surface } from '@/types'
import { Container, Card, SectionLabel, Stat, SignalPill, EdgePill, SurfaceTag, ProbSplit, C, mono, serif } from '@/components/editorial/ui'
import { SURFACE } from '@/lib/editorial/theme'

export const dynamic = 'force-dynamic'

const oddsProvider = new MockOddsProvider()

async function getDashboardData() {
  const rows = await getTodayMatches()

  const enrichedMatches = rows.map(row => {
    const { p1, p2 } = matchRowToPlayers(row)
    const { probability: prob1 } = computeWinProbability(p1, p2, row.surface as Surface)
    const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
    const edgeResult = computeEdge(prob1, odds1)
    return { ...row, p1, p2, prob1, odds1, odds2, edge: edgeResult.edge, signal: edgeResult.signal, kelly: edgeResult.kellyFraction }
  })

  const topEdges = [...enrichedMatches].sort((a, b) => b.edge - a.edge).slice(0, 5)
  const betCount = { BET: 0, LEAN: 0, PASS: 0 } as Record<string, number>
  enrichedMatches.forEach(m => { betCount[m.signal as string] = (betCount[m.signal as string] ?? 0) + 1 })

  const [bets, bankroll] = await Promise.all([
    prisma.bet.findMany({ orderBy: { placedAt: 'desc' }, take: 10 }),
    prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } }),
  ])

  const settledBets = bets.filter((b: any) => b.status === 'SETTLED')
  const wins = settledBets.filter((b: any) => b.result === 'WIN').length
  const winRate = settledBets.length > 0 ? (wins / settledBets.length * 100).toFixed(1) : '—'
  const avgEdge = settledBets.length > 0
    ? (settledBets.reduce((s: number, b: any) => s + b.edge, 0) / settledBets.length * 100).toFixed(1)
    : '—'

  const currentBalance = bankroll?.amount ?? 100
  const pnl = currentBalance - 100
  const roi = ((pnl / 100) * 100).toFixed(1)

  return { topEdges, allMatches: enrichedMatches, bets, betCount, winRate, avgEdge, currentBalance, pnl, roi }
}

export default async function DashboardPage() {
  const { topEdges, allMatches, bets, betCount, winRate, avgEdge, currentBalance, pnl, roi } = await getDashboardData()

  const metrics = [
    { label: 'Bankroll', value: `$${currentBalance.toFixed(2)}`, sub: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${roi}%)`, color: pnl >= 0 ? C.green : C.red },
    { label: "Today's Edges", value: String(allMatches.length), sub: `${betCount.BET ?? 0} BET · ${betCount.LEAN ?? 0} LEAN` },
    { label: 'Win Rate · 30d', value: `${winRate}%`, sub: `${bets.filter((b: any) => b.status === 'SETTLED').length} settled` },
    { label: 'Avg Edge', value: `+${avgEdge}%`, sub: 'Model vs implied', color: C.gold },
  ]

  return (
    <Container>
      {/* Lede */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>RallyIQ · The Daily Board</div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>Today&rsquo;s edges</h1>
      </div>

      {/* Metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 26 }}>
        {metrics.map(mt => (
          <Card key={mt.label} style={{ padding: 18 }}>
            <Stat label={mt.label} value={mt.value} sub={mt.sub} valueColor={mt.color ?? C.ink} />
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28 }}>
        {/* Top edges */}
        <div>
          <SectionLabel>Today&rsquo;s Top Edges</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topEdges.map(m => {
              const acc = (SURFACE[m.surface as string] ?? SURFACE.Hard).accent
              return (
                <Link key={m.match_id} href={`/matches/${m.match_id}`} style={{ textDecoration: 'none' }}>
                  <Card accentRail={m.signal === 'PASS' ? undefined : acc} style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ ...mono, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.tournament.slice(0, 22)}</span>
                      <SurfaceTag surface={m.surface as string} />
                      <span style={{ ...mono, fontSize: 10, color: C.faint }}>{m.round}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <EdgePill edge={m.edge} /><SignalPill signal={m.signal as string} />
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.ink, flex: 1 }}>{m.p1.name}</span>
                      <span style={{ ...serif, fontSize: 13, fontStyle: 'italic', color: C.faint }}>vs</span>
                      <span style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.ink, flex: 1, textAlign: 'right' }}>{m.p2.name}</span>
                    </div>
                    <ProbSplit prob1={m.prob1} accent={acc} />
                  </Card>
                </Link>
              )
            })}
            {topEdges.length === 0 && (
              <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '32px 0' }}>
                No matches loaded · hit Refresh to fetch today&rsquo;s schedule
              </div>
            )}
          </div>
          <Link href="/matches" style={{ ...mono, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', textAlign: 'center', padding: '12px 0', textDecoration: 'none' }}>
            View all {allMatches.length} matches →
          </Link>
        </div>

        {/* Recent bets */}
        <div>
          <SectionLabel>Recent Bets</SectionLabel>
          <Card style={{ padding: 4 }}>
            {bets.slice(0, 8).map((b: any, i: number) => {
              const dotColor = b.result === 'WIN' ? C.green : b.result === 'LOSS' ? C.red : C.gold
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: dotColor, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ ...serif, fontSize: 15, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.playerName}</div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.matchDesc}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: b.pnl != null ? (b.pnl >= 0 ? C.green : C.red) : C.gold }}>
                      {b.pnl != null ? `${b.pnl >= 0 ? '+' : ''}$${Math.abs(b.pnl).toFixed(2)}` : `$${b.stake.toFixed(2)}`}
                    </div>
                    <div style={{ marginTop: 3 }}><SignalPill signal={b.signal} /></div>
                  </div>
                </div>
              )
            })}
            {bets.length === 0 && (
              <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '32px 0' }}>No bets logged yet</div>
            )}
          </Card>
          <Link href="/bankroll" style={{ ...mono, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', textAlign: 'center', padding: '12px 0', textDecoration: 'none' }}>
            View bankroll →
          </Link>
        </div>
      </div>
    </Container>
  )
}
