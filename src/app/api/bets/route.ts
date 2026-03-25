// src/app/api/bets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeBankrollSummary, STARTING_BANKROLL } from '@/lib/betting/bankroll'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  try {
    const where: any = {}
    if (status && status !== 'all') where.status = status

    const bets = await prisma.bet.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      take: 100,
    })

    const allBets = await prisma.bet.findMany()
    const betRecords = allBets.map((b: any) => ({
      id: b.id,
      pnl: b.pnl ?? 0,
      result: b.result as 'WIN' | 'LOSS' | 'PUSH' | null,
      edge: b.edge,
      odds: b.odds,
      closingOdds: b.closingOdds ?? undefined,
      status: b.status as 'OPEN' | 'SETTLED' | 'VOID',
    }))

    const bankrollRecord = await prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } })
    const currentBalance = bankrollRecord?.amount ?? STARTING_BANKROLL
    const summary = computeBankrollSummary(currentBalance, betRecords)

    const snapshots = await prisma.bankrollSnapshot.findMany({
      orderBy: { snapshotAt: 'asc' },
      take: 60,
    })

    return NextResponse.json({ bets, summary, snapshots })
  } catch (error) {
    console.error('Bets API error:', error)
    return NextResponse.json({ error: 'Failed to fetch bets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      matchExternalId, playerExternalId, playerName, matchDesc,
      signal, modelProb, impliedProb, edge, odds, stake
    } = body

    const bet = await prisma.bet.create({
      data: {
        matchExternalId: matchExternalId ?? 'unknown',
        playerExternalId: playerExternalId ?? 'unknown',
        playerName: playerName ?? 'Unknown',
        matchDesc: matchDesc ?? '',
        signal,
        modelProb,
        impliedProb,
        edge,
        odds,
        stake,
        toWin: stake * (odds - 1),
        status: 'OPEN',
      },
    })

    return NextResponse.json({ bet })
  } catch (error) {
    console.error('Place bet error:', error)
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 })
  }
}
