// src/app/api/search/route.ts
// Backs the command palette. Returns at most 8 of each kind.

import { NextRequest, NextResponse } from 'next/server'
import { searchPlayers, searchTournaments } from '@/lib/data/season'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  // An empty query returns nothing without touching the index — the palette
  // fires this on every keystroke including the one that clears the field.
  if (q.length < 2) return NextResponse.json({ tournaments: [], players: [] })

  try {
    return NextResponse.json({
      tournaments: searchTournaments(q).map(t => ({
        slug: t.slug,
        name: t.name,
        surface: t.surface,
        tours: t.tours,
        start: t.start,
        end: t.end,
        matches: t.matches,
      })),
      players: searchPlayers(q).map(p => ({
        id: p.id,
        name: p.name,
        tour: p.tour,
        rank: p.rank,
        elo: p.elo,
      })),
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
