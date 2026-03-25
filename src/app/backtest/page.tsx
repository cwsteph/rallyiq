// src/app/backtest/page.tsx
'use client'
import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { MetricCard, SectionTitle, SurfaceBadge, SignalPill } from '@/components/ui'
import type { Surface, Signal } from '@/types'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded px-2 py-1.5 font-mono text-xs">
      <div className="text-terminal-dim">Bet #{payload[0]?.payload?.i}</div>
      <div className={payload[0]?.value >= 0 ? 'text-green' : 'text-red'}>
        P&L: {payload[0]?.value >= 0 ? '+' : ''}${payload[0]?.value?.toFixed(2)}
      </div>
    </div>
  )
}

export default function BacktestPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [surface, setSurface] = useState('all')
  const [minEdge, setMinEdge] = useState('0.02')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ minEdge })
    if (surface !== 'all') params.set('surface', surface)
    fetch(`/api/backtest?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [surface, minEdge])

  const {
    summary = {}, edgeBuckets = [], surfaceStats = [], curve = [], rows = []
  } = data || {}

  const pnlPositive = (summary.totalPnl ?? 0) >= 0
  const roiPositive = (summary.roi ?? 0) >= 0

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={surface}
          onChange={e => setSurface(e.target.value)}
          className="bg-terminal-surface border border-terminal-border text-terminal-muted font-mono text-xs px-2 py-1.5 rounded"
        >
          <option value="all">All Surfaces</option>
          <option value="Hard">Hard</option>
          <option value="Clay">Clay</option>
          <option value="Grass">Grass</option>
        </select>
        <select
          value={minEdge}
          onChange={e => setMinEdge(e.target.value)}
          className="bg-terminal-surface border border-terminal-border text-terminal-muted font-mono text-xs px-2 py-1.5 rounded"
        >
          <option value="0.02">Min edge 2%</option>
          <option value="0.03">Min edge 3%</option>
          <option value="0.05">Min edge 5%</option>
          <option value="0.08">Min edge 8%</option>
        </select>
        <span className="font-mono text-2xs text-terminal-dim">
          {loading ? 'Loading...' : `${summary.totalBets ?? 0} qualifying bets`}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <MetricCard label="Total Bets" value={summary.totalBets ?? 0} />
        <MetricCard
          label="Win Rate"
          value={`${(summary.winRate ?? 0).toFixed(1)}%`}
          sub={`${summary.wins ?? 0}W / ${(summary.totalBets ?? 0) - (summary.wins ?? 0)}L`}
        />
        <MetricCard
          label="Total P&L"
          value={`${pnlPositive ? '+' : ''}$${(summary.totalPnl ?? 0).toFixed(2)}`}
          valueClass={pnlPositive ? 'text-green' : 'text-red'}
        />
        <MetricCard
          label="ROI"
          value={`${roiPositive ? '+' : ''}${(summary.roi ?? 0).toFixed(1)}%`}
          valueClass={roiPositive ? 'text-green' : 'text-red'}
          sub="per unit staked"
        />
        <MetricCard
          label="Min Edge Filter"
          value={`${(parseFloat(minEdge) * 100).toFixed(0)}%`}
          sub="threshold"
          valueClass="text-amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div>
          <SectionTitle>Cumulative P&L Curve</SectionTitle>
          <div className="bg-terminal-surface border border-terminal-border rounded p-3">
            {curve.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis
                    dataKey="i"
                    tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }}
                    tickLine={false} axisLine={{ stroke: '#1e2a3a' }}
                    interval={Math.max(1, Math.floor(curve.length / 5))}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }}
                    tickLine={false} axisLine={{ stroke: '#1e2a3a' }}
                    tickFormatter={v => `$${v.toFixed(0)}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="pnl" stroke="#00e5a0" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center font-mono text-xs text-terminal-dim">
                {loading ? 'Computing...' : 'No completed matches yet — run npm run db:seed'}
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>ROI by Surface</SectionTitle>
          <div className="bg-terminal-surface border border-terminal-border rounded p-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={surfaceStats} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                <XAxis dataKey="surface" tick={{ fontSize: 10, fill: '#3a5060', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1e2a3a' }} />
                <YAxis tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1e2a3a' }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="bg-terminal-surface border border-terminal-border rounded px-2 py-1.5 font-mono text-xs">
                        <div className="text-terminal-dim">{payload[0]?.payload?.surface}</div>
                        <div className={payload[0]?.value >= 0 ? 'text-green' : 'text-red'}>
                          ROI: {payload[0]?.value}%
                        </div>
                        <div className="text-terminal-muted">n={payload[0]?.payload?.n}</div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="roi" radius={[3, 3, 0, 0]}>
                  {surfaceStats.map((s: any) => (
                    <Cell
                      key={s.surface}
                      fill={s.roi >= 0 ? '#00e5a030' : '#ff4d6a30'}
                      stroke={s.roi >= 0 ? '#00e5a0' : '#ff4d6a'}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <SectionTitle>ROI by Edge Bucket</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {edgeBuckets.map((b: any) => (
          <div key={b.label} className="bg-terminal-surface border border-terminal-border rounded p-3 text-center">
            <div className="font-mono text-2xs text-terminal-dim uppercase tracking-widest mb-2">{b.label}</div>
            <div className={`font-mono text-2xl font-bold ${b.roi >= 0 ? 'text-green' : 'text-red'}`}>
              {b.roi >= 0 ? '+' : ''}{b.roi}%
            </div>
            <div className="font-mono text-2xs text-terminal-dim mt-1.5 space-y-0.5">
              <div>n={b.n} · {b.wins}W · {b.winRate}% WR</div>
              <div className={b.pnl >= 0 ? 'text-green' : 'text-red'}>
                {b.pnl >= 0 ? '+' : ''}${b.pnl.toFixed(2)} P&L
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle>Bet Log</SectionTitle>
      <div className="bg-terminal-surface border border-terminal-border rounded overflow-x-auto">
        <table className="w-full" style={{ minWidth: '700px' }}>
          <thead>
            <tr className="border-b border-terminal-border">
              {['Date', 'Match', 'Surf', 'Model%', 'Impl%', 'Edge', 'Signal', 'Odds', 'Result', 'P&L'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 font-mono text-2xs text-terminal-dim uppercase tracking-widest whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r: any) => r.signal !== 'PASS')
              .map((r: any) => (
                <tr key={r.matchId} className="border-b border-terminal-border/40 hover:bg-terminal-border/20 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs text-terminal-dim whitespace-nowrap">
                    {new Date(r.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 py-2 text-xs text-terminal-text whitespace-nowrap">
                    {r.p1Name.split(' ').pop()} v {r.p2Name.split(' ').pop()}
                  </td>
                  <td className="px-3 py-2">
                    <SurfaceBadge surface={r.surface as Surface} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-green">
                    {(r.modelProb * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-terminal-muted">
                    {(r.impliedProb * 100).toFixed(1)}%
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs font-bold ${r.edge >= 0.05 ? 'text-green' : r.edge >= 0.02 ? 'text-amber' : 'text-terminal-dim'}`}>
                    +{(r.edge * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <SignalPill signal={r.signal as Signal} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-blue font-bold">
                    {r.odds.toFixed(2)}
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs font-bold ${r.betWon === null ? 'text-terminal-dim' : r.betWon ? 'text-green' : 'text-red'}`}>
                    {r.betWon === null ? '—' : r.betWon ? 'WIN' : 'LOSS'}
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs font-bold ${r.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                    {r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
