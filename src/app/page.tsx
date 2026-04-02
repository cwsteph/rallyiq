// src/app/page.tsx
import { getTodayMatches } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability } from '@/lib/model/probability'
import { computeEdge } from '@/lib/betting/edge'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import { prisma } from '@/lib/db'
import { MetricCard, SectionTitle, SurfaceBadge, SignalPill, EdgeBadge, ProbBar, StatusDot } from '@/components/ui'
import Link from 'next/link'
import type { Surface, Signal } from '@/types'

export const dynamic = 'force-dynamic'

const oddsProvider = new MockOddsProvider()

async function getDashboardData() {
  const rows = await getTodayMatches()

  const enrichedMatches = rows.map(row => {
    const { p1, p2 } = matchRowToPlayers(row)
    const { probability: prob1 } = computeWinProbability(p1, p2, row.surface as Surface)
    const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
    const edgeResult = computeEdge(prob1, odds1)
    return { ...row, p1, p2, prob1, odds1, odds2, edge: edgeResult.edge, signal: edgeResult.signal, kelly: edgeResult.kellyFraction }
  })

  const topEdges = [...enrichedMatches].sort((a, b) => b.edge - a.edge).slice(0, 5)
  const betCount = { BET: 0, LEAN: 0, PASS: 0 } as Record<string, number>
  enrichedMatches.forEach(m => { betCount[m.signal as string] = (betCount[m.signal as string] ?? 0) + 1 })

  const [bets, bankroll] = await Promise.all([
    prisma.bet.findMany({ orderBy: { placedAt: 'desc' }, take: 10 }),
    prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } }),
  ])

  const settledBets = bets.filter((b: any) => b.status === 'SETTLED')
  const wins = settledBets.filter((b: any) => b.result === 'WIN').length
  const winRate = settledBets.length > 0 ? (wins / settledBets.length * 100).toFixed(1) : '—'
  const avgEdge = settledBets.length > 0
    ? (settledBets.reduce((s: number, b: any) => s + b.edge, 0) / settledBets.length * 100).toFixed(1)
    : '—'

  const currentBalance = bankroll?.amount ?? 100
  const pnl = currentBalance - 100
  const roi = ((pnl / 100) * 100).toFixed(1)

  return { topEdges, allMatches: enrichedMatches, bets, betCount, winRate, avgEdge, currentBalance, pnl, roi }
}

export default async function DashboardPage() {
  const { topEdges, allMatches, bets, betCount, winRate, avgEdge, currentBalance, pnl, roi } = await getDashboardData()

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <MetricCard label="Bankroll" value={`$${currentBalance.toFixed(2)}`}
          sub={`${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${roi}%)`} valueClass="text-green" />
        <MetricCard label="Today's Edges" value={allMatches.length}
          sub={`${betCount.BET ?? 0} BET · ${betCount.LEAN ?? 0} LEAN`} />
        <MetricCard label="Win Rate (30d)" value={`${winRate}%`}
          sub={`${bets.filter((b: any) => b.status === 'SETTLED').length} settled bets`} />
        <MetricCard label="Avg Edge" value={`+${avgEdge}%`} sub="Model vs Implied" valueClass="text-amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <SectionTitle>Today's Top Edges</SectionTitle>
          <div className="space-y-1.5">
            {topEdges.map(m => (
              <Link key={m.match_id} href={`/matches/${m.match_id}`}>
                <div className={`bg-terminal-surface border rounded p-3 cursor-pointer transition-colors hover:border-terminal-hover
                  ${m.signal === 'BET' ? 'border-l-2 border-l-green border-green' : m.signal === 'LEAN' ? 'border-l-2 border-l-amber border-amber' : 'border-terminal-border'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-2xs text-terminal-dim uppercase">{m.tournament.slice(0, 14)}</span>
                    <SurfaceBadge surface={m.surface as Surface} />
                    <span className="font-mono text-2xs text-terminal-dim">{m.round}</span>
                    <span className="ml-auto"><EdgeBadge edge={m.edge} signal={m.signal as Signal} /></span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-terminal-text flex-1">{m.p1.name}</span>
                    <span className="font-mono text-2xs text-terminal-dim">vs</span>
                    <span className="text-sm font-semibold text-terminal-text flex-1 text-right">{m.p2.name}</span>
                  </div>
                  <ProbBar prob1={m.prob1} p1Name={m.p1.name} p2Name={m.p2.name} />
                </div>
              </Link>
            ))}
            {topEdges.length === 0 && (
              <div className="font-mono text-xs text-terminal-dim text-center py-8">
                No matches loaded · Hit Refresh to fetch today's schedule
              </div>
            )}
          </div>
          <Link href="/matches" className="block mt-2 font-mono text-2xs text-terminal-dim hover:text-terminal-muted text-center py-1">
            View all {allMatches.length} matches →
          </Link>
        </div>

        <div>
          <SectionTitle>Recent Bets</SectionTitle>
          <div className="space-y-1.5">
            {bets.slice(0, 7).map((b: any) => (
              <div key={b.id} className="bg-terminal-surface border border-terminal-border rounded p-2.5 flex items-center gap-3">
                <StatusDot status={(b.result as any) ?? 'OPEN'} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-terminal-text truncate">{b.playerName}</div>
                  <div className="font-mono text-2xs text-terminal-dim truncate">{b.matchDesc}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono text-xs font-bold ${b.pnl != null ? (b.pnl >= 0 ? 'text-green' : 'text-red') : 'text-amber'}`}>
                    {b.pnl != null ? `${b.pnl >= 0 ? '+' : ''}$${Math.abs(b.pnl).toFixed(2)}` : `$${b.stake.toFixed(2)}`}
                  </div>
                  <div className="mt-0.5"><SignalPill signal={b.signal as Signal} /></div>
                </div>
              </div>
            ))}
            {bets.length === 0 && (
              <div className="font-mono text-xs text-terminal-dim text-center py-8">No bets logged yet</div>
            )}
          </div>
          <Link href="/bankroll" className="block mt-2 font-mono text-2xs text-terminal-dim hover:text-terminal-muted text-center py-1">
            View bankroll →
          </Link>
        </div>
      </div>
    </div>
  )
}
