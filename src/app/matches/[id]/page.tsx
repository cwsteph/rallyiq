// src/app/matches/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getTodayMatch } from '@/lib/data/duckdb'
import { matchRowToPlayers } from '@/lib/data/ratingToPlayer'
import { computeWinProbability, toDecimalOdds, toAmericanOdds } from '@/lib/model/probability'
import { computeEdge, suggestedStake } from '@/lib/betting/edge'
import { runSimulation } from '@/lib/sim/matchSimulation'
import { MockOddsProvider } from '@/lib/data/oddsProvider'
import { prisma } from '@/lib/db'
import { Card, SectionTitle, SurfaceBadge, SignalPill, EdgeBadge, ProbBar, KellyMeter, Sparkline } from '@/components/ui'
import Link from 'next/link'
import type { Surface, Signal } from '@/types'

const oddsProvider = new MockOddsProvider()

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const row = await getTodayMatch(params.id)
  if (!row) notFound()

  const { p1, p2 } = matchRowToPlayers(row)
  const surface = row.surface as Surface
  const { probability: prob1, factors } = computeWinProbability(p1, p2, surface)
  const prob2 = 1 - prob1
  const { odds1, odds2 } = oddsProvider.generateOdds(prob1)
  const edge1 = computeEdge(prob1, odds1)
  const edge2 = computeEdge(prob2, odds2)

  const bankroll = await prisma.bankroll.findFirst({ orderBy: { createdAt: 'desc' } })
  const stake1 = suggestedStake(bankroll?.amount ?? 100, prob1, odds1)

  const sim = runSimulation(p1, p2, row.surface, (row.best_of ?? 3) as 3 | 5, 10000)

  const surfKey = surface === 'Hard' ? 'eloHard' : surface === 'Clay' ? 'eloClay' : 'eloGrass'
  const compareStats = [
    { label: 'Elo (Overall)',        v1: p1.eloOverall.toFixed(0),  v2: p2.eloOverall.toFixed(0),  n1: p1.eloOverall,  n2: p2.eloOverall },
    { label: `Elo (${surface})`,     v1: (p1 as any)[surfKey].toFixed(0), v2: (p2 as any)[surfKey].toFixed(0), n1: (p1 as any)[surfKey], n2: (p2 as any)[surfKey] },
    { label: 'Hold %',               v1: `${((p1.holdPct ?? 0)*100).toFixed(1)}%`, v2: `${((p2.holdPct ?? 0)*100).toFixed(1)}%`, n1: p1.holdPct ?? 0, n2: p2.holdPct ?? 0 },
    { label: 'Break %',              v1: `${((p1.breakPct ?? 0)*100).toFixed(1)}%`, v2: `${((p2.breakPct ?? 0)*100).toFixed(1)}%`, n1: p1.breakPct ?? 0, n2: p2.breakPct ?? 0 },
    { label: 'Form (Last 10)',       v1: `${(p1.form10 as number[])?.filter((x:number)=>x).length ?? '?'}/10`, v2: `${(p2.form10 as number[])?.filter((x:number)=>x).length ?? '?'}/10`, n1: (p1.form10 as number[])?.filter((x:number)=>x).length ?? 5, n2: (p2.form10 as number[])?.filter((x:number)=>x).length ?? 5 },
    { label: 'Rank',                 v1: p1.currentRank ? `#${p1.currentRank}` : '—', v2: p2.currentRank ? `#${p2.currentRank}` : '—', n1: -(p1.currentRank ?? 999), n2: -(p2.currentRank ?? 999) },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/matches" className="font-mono text-2xs text-terminal-dim hover:text-terminal-muted border border-terminal-border px-2 py-1 rounded">
          ← Back
        </Link>
        <span className="font-mono text-xs text-terminal-dim uppercase">{row.tournament}</span>
        <SurfaceBadge surface={surface} />
        <span className="font-mono text-xs text-terminal-dim">{row.round} · BO{row.best_of}</span>
      </div>

      <Card className="mb-3">
        <div className="grid grid-cols-[1fr_80px_1fr] gap-4 items-center">
          <div>
            <div className="text-lg font-bold text-terminal-text">{p1.name}</div>
            <div className="font-mono text-xs text-terminal-dim mt-0.5">
              {p1.currentRank ? `#${p1.currentRank}` : '—'} · Elo {p1.eloOverall.toFixed(0)}
            </div>
            <div className="mt-1.5"><Sparkline form={(p1.form10 as number[]) ?? []} /></div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-terminal-dim">VS</div>
            <div className="font-mono text-2xs text-terminal-dim mt-1">{row.match_date}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-terminal-text">{p2.name}</div>
            <div className="font-mono text-xs text-terminal-dim mt-0.5">
              {p2.currentRank ? `#${p2.currentRank}` : '—'} · Elo {p2.eloOverall.toFixed(0)}
            </div>
            <div className="mt-1.5 flex justify-end"><Sparkline form={(p2.form10 as number[]) ?? []} /></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-3">
          <Card>
            <SectionTitle>Model Output</SectionTitle>
            <div className="text-center py-3">
              <div className="font-mono text-2xs text-terminal-dim uppercase tracking-widest mb-1">
                {prob1 >= 0.5 ? p1.name : p2.name} Win Probability
              </div>
              <div className="font-mono text-5xl font-bold text-green">
                {((prob1 >= 0.5 ? prob1 : 1 - prob1) * 100).toFixed(1)}%
              </div>
            </div>
            <ProbBar prob1={prob1} p1Name={p1.name} p2Name={p2.name} />
          </Card>

          <Card>
            <SectionTitle>Betting Signal</SectionTitle>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-terminal-dim uppercase">Signal</span>
                <SignalPill signal={edge1.signal as Signal} />
              </div>
              {[
                ['Model Prob',  `${(prob1 * 100).toFixed(2)}%`, 'text-green'],
                ['Implied Prob',`${(edge1.impliedProb * 100).toFixed(2)}%`, 'text-terminal-text'],
                ['Edge',        `${edge1.edge >= 0 ? '+' : ''}${(edge1.edge * 100).toFixed(2)}%`, edge1.edge >= 0.05 ? 'text-green' : edge1.edge >= 0.02 ? 'text-amber' : 'text-terminal-dim'],
                ['Fair Odds',   `${toDecimalOdds(prob1)} (${toAmericanOdds(prob1)})`, 'text-terminal-text'],
                ['Market Odds', `${odds1} (${toAmericanOdds(edge1.impliedProb)})`, 'text-blue'],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex items-center justify-between border-b border-terminal-border pb-2 last:border-0 last:pb-0">
                  <span className="font-mono text-2xs text-terminal-dim uppercase">{label}</span>
                  <span className={`font-mono text-xs font-medium ${cls}`}>{value}</span>
                </div>
              ))}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-2xs text-terminal-dim uppercase">Kelly Stake</span>
                  <span className="font-mono text-xs text-terminal-text">
                    {edge1.signal !== 'PASS' ? `$${stake1.toFixed(2)}` : 'No bet'}
                  </span>
                </div>
                <KellyMeter fraction={edge1.kellyFraction} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <SectionTitle>Player Comparison</SectionTitle>
            {compareStats.map(s => (
              <div key={s.label} className="grid grid-cols-[1fr_80px_1fr] items-center py-2 border-b border-terminal-border last:border-0">
                <span className={`font-mono text-xs font-semibold ${s.n1 > s.n2 ? 'text-green' : 'text-terminal-text'}`}>{s.v1}</span>
                <span className="font-mono text-terminal-dim text-center text-[9px] uppercase tracking-wide">{s.label}</span>
                <span className={`font-mono text-xs font-semibold text-right ${s.n2 > s.n1 ? 'text-green' : 'text-terminal-text'}`}>{s.v2}</span>
              </div>
            ))}
          </Card>

          <Card>
            <SectionTitle>Simulation (10k runs)</SectionTitle>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="font-mono text-2xs text-terminal-dim mb-1">Sim Win%</div>
                <div className="font-mono text-xl font-bold text-green">{(sim.winProb1 * 100).toFixed(1)}%</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xs text-terminal-dim mb-1">Avg Games</div>
                <div className="font-mono text-xl font-bold text-terminal-text">{sim.avgGames}</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xs text-terminal-dim mb-1">Spread</div>
                <div className="font-mono text-xl font-bold text-amber">{(sim.spreadCoverPct * 100).toFixed(1)}%</div>
              </div>
            </div>
            <SectionTitle>Games Distribution</SectionTitle>
            {Object.entries(sim.gamesDistribution).map(([bucket, pct]) => (
              <div key={bucket} className="grid grid-cols-[60px_1fr_36px] gap-2 items-center mb-1.5">
                <span className="font-mono text-2xs text-terminal-dim">{bucket}</span>
                <div className="h-4 bg-terminal-border rounded overflow-hidden">
                  <div className={`h-full rounded ${(pct as number) > 0.25 ? 'bg-blue/60' : 'bg-terminal-hover'}`}
                    style={{ width: `${Math.round((pct as number) * 100)}%` }} />
                </div>
                <span className="font-mono text-2xs text-terminal-dim text-right">{((pct as number) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
