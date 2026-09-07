// Unified dashboard endpoint — returns standardized bankroll summary
// Called by the cross-app dashboard at paddockiq/public/dashboard.html
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeBankrollSummary, STARTING_BANKROLL } from '@/lib/betting/bankroll'

export async function GET() {
  try {
    const allBets = await prisma.bet.findMany({ orderBy: { placedAt: 'asc' } })
    const betRecords = allBets.map((b: any) => ({
      id: b.id,
      pnl: b.pnl ?? 0,
      result: b.result as 'WIN' | 'LOSS' | 'PUSH' | null,
      edge: b.edge,
      odds: b.odds,
      closingOdds: b.closingOdds ?? undefined,
      stake: b.stake,
      status: b.status as 'OPEN' | 'SETTLED' | 'VOID',
    }))

    const bankrollRecord = await prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } })
    const currentBalance = bankrollRecord?.amount ?? STARTING_BANKROLL
    const summary = computeBankrollSummary(currentBalance, betRecords)

    const snapshots = await prisma.bankrollSnapshot.findMany({
      orderBy: { snapshotAt: 'asc' },
      take: 90,
    })

    // Recent settled bets for activity feed
    const recentBets = allBets
      .filter((b: any) => b.status === 'SETTLED')
      .slice(-20)
      .reverse()
      .map((b: any) => ({
        date: b.settledAt || b.placedAt,
        desc: b.playerName + ' — ' + (b.matchDesc || ''),
        result: b.result,
        pnl: b.pnl ?? 0,
        odds: b.odds,
        stake: b.stake,
      }))

    return NextResponse.json({
      sport: 'tennis',
      app: 'RallyIQ',
      starting: STARTING_BANKROLL,
      current: currentBalance,
      summary,
      snapshots: snapshots.map((s: any) => ({
        date: s.snapshotAt,
        balance: s.balance,
      })),
      recentBets,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
