// src/app/api/refresh/route.ts
//
// Reports what the published slate holds. It does not fetch anything.
//
// This route used to carry a POST that pulled ESPN and wrote the Neon
// TodayMatch table — a fork of scripts/fetch-today.ts that kept two bugs the
// script had already fixed: https.get, which ESPN 403s on the scoreboard
// whatever User-Agent you send, and slugified player ids, which orphan every
// ratings lookup. It could not have worked, and a serverless function cannot
// write a committed file anyway. The daily GitHub Actions refresh is the only
// writer; this endpoint just reads the result.

import { NextResponse } from 'next/server'
import { getTodayMatches } from '@/lib/data/duckdb'
import { readHealth } from '@/components/StalenessBanner'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const matches = await getTodayMatches()
    const health = readHealth()

    return NextResponse.json({
      ok: true,
      matchCount: matches.length,
      lastUpdated: health?.feeds?.slate?.lastSuccess ?? null,
      generated: health?.generated ?? null,
    })
  } catch (error) {
    console.error('Refresh status error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to read the slate' }, { status: 500 })
  }
}
