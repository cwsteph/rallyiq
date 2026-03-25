// src/app/api/backtest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBacktestMatches } from '@/lib/data/duckdb'
import { computeWinProbability } from '@/lib/model/probability'
import { computeEdge } from '@/lib/betting/edge'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import type { Surface } from '@/types'

const oddsProvider = new MockOddsProvider()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const surface = searchParams.get('surface') ?? 'all'
  const minEdge = parseFloat(searchParams.get('minEdge') ?? '0.02')
  const limit   = parseInt(searchParams.get('limit') ?? '500')

  try {
    const rows = await getBacktestMatches()

    const results = rows.map((row: any) => {
      const p1 = {
        id: row.winner_id, name: row.winner_name, tour: 'ATP' as const,
        eloOverall: row.w_elo ?? 1500, eloHard: row.w_elo_hard ?? 1500,
        eloClay: row.w_elo_clay ?? 1500, eloGrass: row.w_elo_grass ?? 1500,
        holdPct: row.w_hold ?? 0.75, breakPct: row.w_break ?? 0.25,
        form10: [], formScore: row.w_form ?? 0.5,
      }
      const p2 = {
        id: row.loser_id, name: row.loser_name, tour: 'ATP' as const,
        eloOverall: row.l_elo ?? 1500, eloHard: row.l_elo_hard ?? 1500,
        eloClay: row.l_elo_clay ?? 1500, eloGrass: row.l_elo_grass ?? 1500,
        holdPct: row.l_hold ?? 0.75, breakPct: row.l_break ?? 0.25,
        form10: [], formScore: row.l_form ?? 0.5,
      }

      const { probability: prob1 } = computeWinProbability(p1, p2, row.surface as Surface)
      const { odds1 } = oddsProvider.generateOdds(prob1)
      const { edge, signal, impliedProb } = computeEdge(prob1, odds1)

      // Winner is always p1 in Sackmann format
      const betOnWinner = prob1 > 0.5
      const betOdds     = betOnWinner ? odds1 : (1 / Math.max(0.01, 1 - impliedProb))
      const betWon      = betOnWinner   // winner always wins in historical data
      const pnl         = signal !== 'PASS'
        ? (betWon ? 1 * (betOdds - 1) : -1)
        : 0

      return {
        matchId: row.match_id, matchDate: row.match_date,
        tournament: row.tournament, surface: row.surface, round: row.round,
        p1Name: row.winner_name, p2Name: row.loser_name,
        modelProb: Math.round(prob1 * 1000) / 1000,
        impliedProb: Math.round(impliedProb * 1000) / 1000,
        edge: Math.round(edge * 1000) / 1000,
        signal, odds: Math.round(betOdds * 100) / 100,
        betWon: signal !== 'PASS' ? betWon : null,
        pnl: Math.round(pnl * 100) / 100,
      }
    })

    const bettable = results.filter((r: any) => r.signal !== 'PASS' && r.edge >= minEdge)
    const wins = bettable.filter((r: any) => r.betWon).length
    const totalPnl = bettable.reduce((s: number, r: any) => s + r.pnl, 0)
    const roi = bettable.length > 0 ? (totalPnl / bettable.length) * 100 : 0
    const winRate = bettable.length > 0 ? (wins / bettable.length) * 100 : 0

    const edgeBuckets = [
      { label: '2–3%', min: 0.02, max: 0.03 },
      { label: '3–5%', min: 0.03, max: 0.05 },
      { label: '5–8%', min: 0.05, max: 0.08 },
      { label: '8%+',  min: 0.08, max: 1.0  },
    ].map(b => {
      const bucket = bettable.filter((r: any) => r.edge >= b.min && r.edge < b.max)
      const bWins  = bucket.filter((r: any) => r.betWon).length
      const bPnl   = bucket.reduce((s: number, r: any) => s + r.pnl, 0)
      return {
        label: b.label, n: bucket.length, wins: bWins,
        pnl: Math.round(bPnl * 100) / 100,
        roi: bucket.length > 0 ? Math.round((bPnl / bucket.length) * 1000) / 10 : 0,
        winRate: bucket.length > 0 ? Math.round((bWins / bucket.length) * 1000) / 10 : 0,
      }
    })

    const surfaceStats = ['Hard', 'Clay', 'Grass'].map(s => {
      const sRows  = bettable.filter((r: any) => r.surface === s)
      const sWins  = sRows.filter((r: any) => r.betWon).length
      const sPnl   = sRows.reduce((sum: number, r: any) => sum + r.pnl, 0)
      return {
        surface: s, n: sRows.length, wins: sWins,
        pnl:     Math.round(sPnl * 100) / 100,
        roi:     sRows.length > 0 ? Math.round((sPnl / sRows.length) * 1000) / 10 : 0,
        winRate: sRows.length > 0 ? Math.round((sWins / sRows.length) * 1000) / 10 : 0,
      }
    })

    let cumPnl = 0
    const curve = bettable.map((r: any, i: number) => {
      cumPnl += r.pnl
      return { i: i + 1, pnl: Math.round(cumPnl * 100) / 100, date: r.matchDate }
    })

    return NextResponse.json({
      summary: {
        totalBets: bettable.length, wins,
        totalPnl: Math.round(totalPnl * 100) / 100,
        roi: Math.round(roi * 10) / 10,
        winRate: Math.round(winRate * 10) / 10,
      },
      edgeBuckets, surfaceStats, curve,
      rows: results.slice(0, 100),
    })
  } catch (error) {
    console.error('Backtest error:', error)
    return NextResponse.json({ error: 'Backtest failed' }, { status: 500 })
  }
}
