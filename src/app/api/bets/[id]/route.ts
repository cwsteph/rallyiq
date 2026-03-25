// src/app/api/bets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { result, closingOdds } = await req.json()

    const bet = await prisma.bet.findUnique({ where: { id: params.id } })
    if (!bet) return NextResponse.json({ error: 'Bet not found' }, { status: 404 })

    let pnl = 0
    if (result === 'WIN')  pnl =  bet.stake * (bet.odds - 1)
    if (result === 'LOSS') pnl = -bet.stake

    let clv = null
    if (closingOdds) {
      clv = (1 / closingOdds - 1 / bet.odds) * 100
    }

    const updated = await prisma.bet.update({
      where: { id: params.id },
      data: {
        status: result === 'VOID' ? 'VOID' : 'SETTLED',
        result: result === 'VOID' ? null : result,
        pnl, clv,
        closingOdds: closingOdds ?? null,
        settledAt: new Date(),
      },
    })

    if (result !== 'VOID') {
      const current = await prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } })
      const newAmount = (current?.amount ?? 100) + pnl
      await prisma.bankroll.create({ data: { amount: newAmount, note: `Settled: ${result}` } })
      await prisma.bankrollSnapshot.create({ data: { balance: newAmount } })
    }

    return NextResponse.json({ bet: updated, pnl })
  } catch (error) {
    console.error('Settle bet error:', error)
    return NextResponse.json({ error: 'Failed to settle bet' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updated = await prisma.bet.update({
      where: { id: params.id },
      data: { status: 'CANCELLED' },
    })
    return NextResponse.json({ bet: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to cancel bet' }, { status: 500 })
  }
}
