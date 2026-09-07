// src/app/api/matches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { enrichedSlate } from '@/lib/data/slate'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const surfaceFilter = searchParams.get('surface')
  const signalFilter  = searchParams.get('signal')

  try {
    const enriched = await enrichedSlate()

    const filtered = enriched
      .filter((m: any) => !surfaceFilter || surfaceFilter === 'all' || m.surface === surfaceFilter)
      .filter((m: any) => !signalFilter  || signalFilter  === 'all' || m.signal  === signalFilter)

    return NextResponse.json({ matches: filtered, total: filtered.length })
  } catch (error) {
    console.error('Matches API error:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}
