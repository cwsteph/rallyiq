// src/app/api/matches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTodayMatches } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability, toDecimalOdds, toAmericanOdds } from '@/lib/model/probability'
import { computeEdge } from '@/lib/betting/edge'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import type { Surface } from '@/types'

const oddsProvider = new MockOddsProvider()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const surfaceFilter = searchParams.get('surface')
  const signalFilter  = searchParams.get('signal')

  try {
    const rows = await getTodayMatches()

    const enriched = rows.map((row: any) => {
      const { p1, p2 } = matchRowToPlayers(row)
      const surface = row.surface as Surface
      const { probability: prob1, factors } = computeWinProbability(p1, p2, surface)
      const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
      const edgeResult = computeEdge(prob1, odds1)

      return {
        id: row.match_id, tournament: row.tournament, surface,
        round: row.round, bestOf: row.best_of, matchDate: row.match_date,
        status: 'SCHEDULED', player1: p1, player2: p2,
        modelProb1: Math.round(prob1 * 10000) / 10000,
        modelProb2: Math.round((1 - prob1) * 10000) / 10000,
        impliedProb1: Math.round(edgeResult.impliedProb * 10000) / 10000,
        edge1: Math.round(edgeResult.edge * 10000) / 10000,
        signal: edgeResult.signal,
        fairOdds1: toDecimalOdds(prob1), fairOdds2: toDecimalOdds(1 - prob1),
        fairOddsAmerican1: toAmericanOdds(prob1), fairOddsAmerican2: toAmericanOdds(1 - prob1),
        marketOdds1: odds1, marketOdds2: odds2,
        kellyFraction: Math.round(edgeResult.kellyFraction * 10000) / 10000,
        factors,
      }
    })

    const filtered = enriched
      .filter((m: any) => !surfaceFilter || surfaceFilter === 'all' || m.surface === surfaceFilter)
      .filter((m: any) => !signalFilter  || signalFilter  === 'all' || m.signal  === signalFilter)

    return NextResponse.json({ matches: filtered, total: filtered.length })
  } catch (error) {
    console.error('Matches API error:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}
