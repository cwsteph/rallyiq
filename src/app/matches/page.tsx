// src/app/matches/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SectionTitle, SurfaceBadge, SignalPill, EdgeBadge, ProbBar } from '@/components/ui'
import type { Signal, Surface } from '@/types'

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [surfaceFilter, setSurfaceFilter] = useState('all')
  const [signalFilter, setSignalFilter] = useState('all')

  useEffect(() => {
    const params = new URLSearchParams({ status: 'SCHEDULED' })
    if (surfaceFilter !== 'all') params.set('surface', surfaceFilter)
    if (signalFilter !== 'all') params.set('signal', signalFilter)

    setLoading(true)
    fetch(`/api/matches?${params}`)
      .then(r => r.json())
      .then(d => { setMatches(d.matches || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [surfaceFilter, signalFilter])

  const signalCounts = { BET: 0, LEAN: 0, PASS: 0 }
  matches.forEach(m => { if (m.signal) signalCounts[m.signal as Signal]++ })

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={surfaceFilter}
          onChange={e => setSurfaceFilter(e.target.value)}
          className="bg-terminal-surface border border-terminal-border text-terminal-muted font-mono text-xs px-2 py-1.5 rounded"
        >
          <option value="all">All Surfaces</option>
          <option value="Hard">Hard</option>
          <option value="Clay">Clay</option>
          <option value="Grass">Grass</option>
        </select>
        <select
          value={signalFilter}
          onChange={e => setSignalFilter(e.target.value)}
          className="bg-terminal-surface border border-terminal-border text-terminal-muted font-mono text-xs px-2 py-1.5 rounded"
        >
          <option value="all">All Signals</option>
          <option value="BET">BET only</option>
          <option value="LEAN">LEAN only</option>
          <option value="PASS">PASS only</option>
        </select>
        <div className="flex items-center gap-2 ml-2">
          <span className="font-mono text-2xs px-2 py-1 rounded bg-green-bg text-green border border-green/20">
            {signalCounts.BET} BET
          </span>
          <span className="font-mono text-2xs px-2 py-1 rounded bg-amber-bg text-amber border border-amber/20">
            {signalCounts.LEAN} LEAN
          </span>
          <span className="font-mono text-2xs text-terminal-dim">{matches.length} total</span>
        </div>
      </div>

      <SectionTitle>Today's Matches</SectionTitle>

      {loading ? (
        <div className="font-mono text-xs text-terminal-dim text-center py-8">Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="font-mono text-xs text-terminal-dim text-center py-8">No matches found</div>
      ) : (
        <div className="space-y-2">
          {matches.map(m => (
            <Link key={m.id} href={`/matches/${m.id}`}>
              <div className={`
                bg-terminal-surface border rounded p-3 cursor-pointer transition-colors hover:border-terminal-hover
                ${m.signal === 'BET' ? 'border-l-2 border-green' : m.signal === 'LEAN' ? 'border-l-2 border-amber' : 'border-terminal-border'}
              `}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-2xs bg-terminal-border/40 text-terminal-dim px-1.5 py-0.5 rounded uppercase tracking-wide">
                    {m.tournament?.slice(0, 14)}
                  </span>
                  <SurfaceBadge surface={m.surface as Surface} />
                  <span className="font-mono text-2xs text-terminal-dim">{m.round}</span>
                  <span className="font-mono text-2xs text-terminal-dim">
                    BO{m.bestOf}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <SignalPill signal={m.signal as Signal} />
                    <EdgeBadge edge={m.edge1 ?? 0} signal={m.signal as Signal} />
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-2">
                  <div>
                    <div className="text-sm font-semibold text-terminal-text">{m.player1?.name}</div>
                    <div className="font-mono text-2xs text-terminal-dim">
                      Elo {m.player1?.eloOverall?.toFixed(0)} · #{m.player1?.currentRank ?? '—'}
                    </div>
                  </div>
                  <div className="font-mono text-2xs text-terminal-dim text-center">vs</div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-terminal-text">{m.player2?.name}</div>
                    <div className="font-mono text-2xs text-terminal-dim">
                      Elo {m.player2?.eloOverall?.toFixed(0)} · #{m.player2?.currentRank ?? '—'}
                    </div>
                  </div>
                </div>

                <ProbBar prob1={m.modelProb1 ?? 0.5} p1Name={m.player1?.name} p2Name={m.player2?.name} />

                <div className="flex items-center gap-4 mt-2 font-mono text-2xs text-terminal-dim">
                  <span>Model: <span className="text-green">{((m.modelProb1 ?? 0.5) * 100).toFixed(1)}%</span></span>
                  <span>Implied: {((m.impliedProb1 ?? 0.5) * 100).toFixed(1)}%</span>
                  <span>Fair: {m.fairOdds1} ({m.fairOddsAmerican1})</span>
                  <span>Mkt: <span className="text-blue">{m.marketOdds1}</span></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
