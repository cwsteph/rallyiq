// src/app/matches/[id]/page.tsx
//
// "The Read" match-detail page. Reuses RallyIQ's existing model/sim/edge
// functions, assembles a ReadModel, and renders the editorial <MatchRead/> view.
// Drop-in replacement for the previous match detail page.

import { notFound } from 'next/navigation'
import { getTodayMatch, getH2H } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability, toDecimalOdds, toAmericanOdds } from '@/lib/model/probability'
import { computeEdge, suggestedStake } from '@/lib/betting/edge'
import { runSimulation } from '@/lib/sim/matchSimulation'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import { prisma } from '@/lib/db'
import { buildReadModel, type ReadH2H } from '@/lib/read/buildReadModel'
import MatchRead from '@/components/match/MatchRead'
import type { Surface } from '@/types'

const oddsProvider = new MockOddsProvider()

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const row = await getTodayMatch(params.id)
  if (!row) notFound()

  const { p1, p2 } = matchRowToPlayers(row)
  const surface = row.surface as Surface
  const { probability: prob1, factors } = computeWinProbability(p1, p2, surface)
  const prob2 = 1 - prob1
  const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
  const edge1 = computeEdge(prob1, odds1)
  const edge2 = computeEdge(prob2, odds2)

  const bankroll = await prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } })
  const balance = bankroll?.amount ?? 100
  const stake = suggestedStake(balance, prob1, odds1)

  const sim = runSimulation(p1, p2, row.surface, (row.best_of ?? 3) as 3 | 5, 10000)

  // ── head-to-head → ReadH2H ──
  const raw = await getH2H(row.player1_id, row.player2_id)
  let p1Wins = 0, p2Wins = 0
  const recent = raw.slice(0, 4).map((mtch: any) => {
    const winner: 1 | 2 = mtch.winner_id === row.player1_id ? 1 : 2
    if (winner === 1) p1Wins++; else p2Wins++
    return {
      event: mtch.tournament, surface: mtch.surface,
      year: new Date(mtch.match_date).getFullYear(),
      winner, score: mtch.score,
    }
  })
  // tally across all meetings (not just the 4 shown)
  p1Wins = raw.filter((x: any) => x.winner_id === row.player1_id).length
  p2Wins = raw.length - p1Wins
  const h2h: ReadH2H = {
    meetings: raw.length, p1Wins, p2Wins,
    note: raw.length === 0 ? 'First career meeting'
      : p1Wins === p2Wins ? `Split ${p1Wins}–${p2Wins} lifetime`
      : `Leads ${Math.max(p1Wins, p2Wins)}–${Math.min(p1Wins, p2Wins)} lifetime`,
    recent,
  }

  const dateLong = new Date(row.match_date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

  const model = buildReadModel({
    row, p1, p2, surface,
    prob1, factors,
    fairOdds1: toDecimalOdds(prob1), fairOdds2: toDecimalOdds(prob2),
    fairAmerican1: toAmericanOdds(prob1), fairAmerican2: toAmericanOdds(prob2),
    marketOdds1: odds1, marketOdds2: odds2,
    marketAmerican1: toAmericanOdds(edge1.impliedProb), marketAmerican2: toAmericanOdds(edge2.impliedProb),
    implied1: edge1.impliedProb, implied2: edge2.impliedProb,
    edge1: edge1.edge, edge2: edge2.edge, signal: edge1.signal,
    kellyFraction: edge1.signal === 'PASS' && edge2.edge > edge1.edge ? edge2.kellyFraction : edge1.kellyFraction,
    suggestedStake: stake,
    sim, h2h,
    dateLong, court: undefined, timeLocal: undefined,
  })

  return <MatchRead model={model} />
}
