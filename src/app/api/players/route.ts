// src/app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPlayers } from '@/lib/data/duckdb'
import { ratingToPlayer } from '@/lib/data/ratingToPlayer'
import { toDecimalOdds } from '@/lib/model/probability'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tour    = (searchParams.get('tour') || 'ATP') as 'ATP' | 'WTA'
  const surface = searchParams.get('surface') || 'overall'

  try {
    const ratings = await getPlayers(tour)

    const avgElo = ratings.length > 0
      ? ratings.reduce((s: number, p: any) => s + (p.elo_overall ?? 1500), 0) / ratings.length
      : 1500

    const surfEloKey = surface === 'hard' ? 'elo_hard'
      : surface === 'clay'  ? 'elo_clay'
      : surface === 'grass' ? 'elo_grass'
      : 'elo_overall'

    const sorted = [...ratings].sort((a: any, b: any) => (b[surfEloKey] ?? 1500) - (a[surfEloKey] ?? 1500))

    const enriched = sorted.map((r: any, i: number) => {
      const fairProb = 1 / (1 + Math.pow(10, (avgElo - (r.elo_overall ?? 1500)) / 400))
      return {
        ...ratingToPlayer(r),
        rank: i + 1,
        surfaceElo: r[surfEloKey] ?? 1500,
        fairOdds: toDecimalOdds(fairProb),
        fairProb: Math.round(fairProb * 1000) / 1000,
        matchesPlayed: r.matches_played ?? 0,
      }
    })

    return NextResponse.json({ players: enriched })
  } catch (error) {
    console.error('Players API error:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
}
