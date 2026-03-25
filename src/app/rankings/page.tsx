// src/app/rankings/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { SectionTitle, SurfaceBadge, Sparkline } from '@/components/ui'

export default function RankingsPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tour, setTour] = useState('ATP')
  const [surface, setSurface] = useState('overall')
  const [sortBy, setSortBy] = useState('eloOverall')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/players?tour=${tour}&surface=${surface}&sortBy=${sortBy}`)
      .then(r => r.json())
      .then(d => { setPlayers(d.players || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tour, surface, sortBy])

  const surfaceLabel = surface === 'hard' ? 'Hard' : surface === 'clay' ? 'Clay' : surface === 'grass' ? 'Grass' : 'Overall'

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['ATP', 'WTA'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTour(t)}
            className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${
              tour === t ? 'bg-green-bg text-green border-green/30' : 'bg-terminal-surface text-terminal-dim border-terminal-border hover:border-terminal-hover'
            }`}
          >
            {t}
          </button>
        ))}
        <select
          value={surface}
          onChange={e => setSurface(e.target.value)}
          className="bg-terminal-surface border border-terminal-border text-terminal-muted font-mono text-xs px-2 py-1.5 rounded ml-2"
        >
          <option value="overall">Overall Elo</option>
          <option value="hard">Hard Elo</option>
          <option value="clay">Clay Elo</option>
          <option value="grass">Grass Elo</option>
        </select>
        <span className="font-mono text-2xs text-terminal-dim">{players.length} players</span>
      </div>

      <SectionTitle>Player Rankings — {tour} · {surfaceLabel}</SectionTitle>

      {loading ? (
        <div className="font-mono text-xs text-terminal-dim text-center py-8">Loading rankings...</div>
      ) : (
        <div className="bg-terminal-surface border border-terminal-border rounded overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '700px' }}>
            <thead>
              <tr className="border-b border-terminal-border">
                {[
                  { key: '', label: '#', w: '36px' },
                  { key: 'name', label: 'Player', w: 'auto' },
                  { key: 'currentRank', label: 'Rank', w: '60px' },
                  { key: 'eloOverall', label: 'Elo', w: '70px' },
                  { key: 'surfaceElo', label: `${surfaceLabel} Elo`, w: '80px' },
                  { key: 'form', label: 'Form', w: '90px' },
                  { key: 'holdPct', label: 'Hold%', w: '70px' },
                  { key: 'breakPct', label: 'Break%', w: '70px' },
                  { key: 'fairOdds', label: 'Fair Odds', w: '80px' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key && setSortBy(col.key)}
                    className={`text-left px-3 py-2.5 font-mono text-2xs text-terminal-dim uppercase tracking-widest cursor-pointer hover:text-terminal-muted ${sortBy === col.key ? 'text-green' : ''}`}
                    style={{ width: col.w }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.id} className="border-b border-terminal-border/50 hover:bg-terminal-border/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-2xs text-terminal-dim">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-semibold text-terminal-text truncate">{p.name}</div>
                    <div className="font-mono text-2xs text-terminal-dim">{p.nationality}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-terminal-muted">
                    {p.currentRank ? `#${p.currentRank}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-terminal-text font-medium">
                    {p.eloOverall.toFixed(0)}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-xs font-semibold ${p.surfaceElo > p.eloOverall ? 'text-green' : p.surfaceElo < p.eloOverall ? 'text-amber' : 'text-terminal-text'}`}>
                    {p.surfaceElo?.toFixed(0) ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {Array.isArray(p.form10) && p.form10.length > 0 ? <Sparkline form={p.form10} /> : <span className="text-terminal-dim">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-terminal-text">
                    {p.holdPct ? `${(p.holdPct * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-terminal-text">
                    {p.breakPct ? `${(p.breakPct * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-blue font-bold">
                    {p.fairOdds?.toFixed(2) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
