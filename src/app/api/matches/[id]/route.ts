// src/app/api/matches/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTodayMatch, getH2H } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability, toDecimalOdds, toAmericanOdds } from '@/lib/model/probability'
import { computeEdge, suggestedStake } from '@/lib/betting/edge'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import { prisma } from '@/lib/db'
import type { Surface } from '@/types'

const oddsProvider = new MockOddsProvider()

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await getTodayMatch(params.id)
    if (!row) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const { p1, p2 } = matchRowToPlayers(row)
    const surface = row.surface as Surface
    const { probability: prob1, factors } = computeWinProbability(p1, p2, surface)
    const prob2 = 1 - prob1
    const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
    const edge1 = computeEdge(prob1, odds1)
    const edge2 = computeEdge(prob2, odds2)

    const bankroll = await prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } })
    const balance  = bankroll?.amount ?? 100
    const stake1   = suggestedStake(balance, prob1, odds1)

    const h2h = await getH2H(row.player1_id, row.player2_id)

    return NextResponse.json({
      analysis: {
        matchId: row.match_id, tournament: row.tournament,
        surface, round: row.round, bestOf: row.best_of, matchDate: row.match_date,
        player1: p1, player2: p2,
        modelProb1: Math.round(prob1 * 10000) / 10000,
        modelProb2: Math.round(prob2 * 10000) / 10000,
        impliedProb1: Math.round(edge1.impliedProb * 10000) / 10000,
        edge1: Math.round(edge1.edge * 10000) / 10000,
        signal: edge1.signal,
        fairOdds1: toDecimalOdds(prob1), fairOdds2: toDecimalOdds(prob2),
        fairOddsAmerican1: toAmericanOdds(prob1), fairOddsAmerican2: toAmericanOdds(prob2),
        marketOdds1: odds1, marketOdds2: odds2,
        kellyFraction1: Math.round(edge1.kellyFraction * 10000) / 10000,
        suggestedStake1: Math.round(stake1 * 100) / 100,
        factors,
        h2h: h2h.map((m: any) => ({
          matchDate: m.match_date, surface: m.surface,
          tournament: m.tournament, round: m.round,
          winnerId: m.winner_id, score: m.score,
          player1Name: m.winner_name, player2Name: m.loser_name,
        })),
      }
    })
  } catch (error) {
    console.error('Match detail error:', error)
    return NextResponse.json({ error: 'Failed to analyse match' }, { status: 500 })
  }
}
