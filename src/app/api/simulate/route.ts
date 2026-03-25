// src/app/api/simulate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTodayMatch } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { runSimulation } from '@/lib/sim/matchSimulation'

export async function POST(req: NextRequest) {
  try {
    const { matchId, iterations = 10000 } = await req.json()
    const row = await getTodayMatch(matchId)
    if (!row) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const { p1, p2 } = matchRowToPlayers(row)
    const result = runSimulation(p1, p2, row.surface, (row.best_of ?? 3) as 3 | 5, Math.min(iterations, 50000))

    return NextResponse.json({ simulation: result })
  } catch (error) {
    console.error('Simulate error:', error)
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 })
  }
}
