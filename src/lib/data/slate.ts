// src/lib/data/slate.ts
// The enriched slate: today's matches joined to ratings, priced, and edged.
//
// Extracted from api/matches/route.ts so the tournament and player pages
// render the same numbers the API serves rather than reimplementing the
// pipeline twice more.

import { getTodayMatches } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability, toDecimalOdds, toAmericanOdds } from '@/lib/model/probability'
import { computeEdge } from '@/lib/betting/edge'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import { tournamentSlug } from '@/lib/search/slug'
import type { Surface } from '@/types'

const oddsProvider = new MockOddsProvider()

export interface EnrichedMatch {
  id: string
  tournament: string
  tournamentSlug: string
  surface: Surface
  round: string
  bestOf: number
  matchDate: string
  scheduledTime?: string
  tour: 'ATP' | 'WTA'
  status: 'SCHEDULED'
  player1: ReturnType<typeof matchRowToPlayers>['p1']
  player2: ReturnType<typeof matchRowToPlayers>['p2']
  modelProb1: number
  modelProb2: number
  impliedProb1: number
  edge1: number
  signal: string
  fairOdds1: number
  fairOdds2: number
  fairOddsAmerican1: string
  fairOddsAmerican2: string
  marketOdds1: number
  marketOdds2: number
  kellyFraction: number
  factors: unknown
}

export async function enrichedSlate(): Promise<EnrichedMatch[]> {
  const rows = await getTodayMatches()

  return rows.map((row: any) => {
    const { p1, p2 } = matchRowToPlayers(row)
    const surface = row.surface as Surface
    const { probability: prob1, factors } = computeWinProbability(p1, p2, surface)
    const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
    const edgeResult = computeEdge(prob1, odds1)

    return {
      id: row.match_id,
      tournament: row.tournament,
      tournamentSlug: tournamentSlug(row.tournament),
      surface,
      round: row.round,
      bestOf: row.best_of,
      matchDate: row.match_date,
      scheduledTime: row.scheduled_time,
      tour: row.tour,
      status: 'SCHEDULED' as const,
      player1: p1,
      player2: p2,
      modelProb1: Math.round(prob1 * 10000) / 10000,
      modelProb2: Math.round((1 - prob1) * 10000) / 10000,
      impliedProb1: Math.round(edgeResult.impliedProb * 10000) / 10000,
      edge1: Math.round(edgeResult.edge * 10000) / 10000,
      signal: edgeResult.signal,
      fairOdds1: toDecimalOdds(prob1),
      fairOdds2: toDecimalOdds(1 - prob1),
      fairOddsAmerican1: toAmericanOdds(prob1),
      fairOddsAmerican2: toAmericanOdds(1 - prob1),
      marketOdds1: odds1,
      marketOdds2: odds2,
      kellyFraction: Math.round(edgeResult.kellyFraction * 10000) / 10000,
      factors,
    }
  })
}

/** Matches on the current slate involving one player, keyed tour:player_id. */
export async function slateForPlayer(tour: string, playerId: string): Promise<EnrichedMatch[]> {
  const slate = await enrichedSlate()
  return slate.filter(
    m =>
      (m.tour === tour && m.player1.id === playerId) ||
      (m.tour === tour && m.player2.id === playerId),
  )
}

export async function slateForTournament(slug: string): Promise<EnrichedMatch[]> {
  return (await enrichedSlate()).filter(m => m.tournamentSlug === slug)
}
