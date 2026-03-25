// src/app/bankroll/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { MetricCard, SectionTitle, SurfaceBadge, SignalPill, StatusDot } from '@/components/ui'
import type { Signal, Surface } from '@/types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded px-2 py-1.5 font-mono text-xs">
      <div className="text-terminal-dim mb-0.5">{label}</div>
      <div className="text-green">${payload[0]?.value?.toFixed(2)}</div>
    </div>
  )
}

export default function BankrollPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bets?status=all&limit=50')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="font-mono text-xs text-terminal-dim text-center py-8">Loading...</div>

  const { bets = [], summary = {}, snapshots = [] } = data || {}

  const chartData = snapshots.map((s: any) => ({
    date: new Date(s.snapshotAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    balance: s.balance,
  }))

  // P&L by surface
  const surfacePnl: Record<string, number> = { Hard: 0, Clay: 0, Grass: 0 }
  bets.filter((b: any) => b.status === 'SETTLED').forEach((b: any) => {
    const surf = (b as any).surface
    if (surf && surfacePnl[surf] !== undefined) surfacePnl[surf] += (b.pnl ?? 0)
  })
  const surfaceData = Object.entries(surfacePnl).map(([surf, pnl]) => ({ surf, pnl: Math.round(pnl * 100) / 100 }))

  const openBets = bets.filter((b: any) => b.status === 'OPEN')
  const settledBets = bets.filter((b: any) => b.status === 'SETTLED')

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <MetricCard label="Bankroll" value={`$${(summary.current ?? 100).toFixed(2)}`} sub={`+${(summary.roi ?? 0).toFixed(1)}% ROI`} valueClass="text-green" />
        <MetricCard label="Open Bets" value={summary.openBets ?? 0} sub={`$${openBets.reduce((s: number, b: any) => s + b.stake, 0).toFixed(2)} at risk`} valueClass="text-amber" />
        <MetricCard label="Settled P&L" value={`${(summary.totalPnl ?? 0) >= 0 ? '+' : ''}$${(summary.totalPnl ?? 0).toFixed(2)}`} sub={`${summary.wins ?? 0}W · ${summary.losses ?? 0}L · ${summary.totalBets ?? 0} total`} valueClass={(summary.totalPnl ?? 0) >= 0 ? 'text-green' : 'text-red'} />
        <MetricCard label="Max Drawdown" value={`-$${(summary.maxDrawdown ?? 0).toFixed(2)}`} sub={`-${(summary.maxDrawdownPct ?? 0).toFixed(1)}% from peak`} valueClass="text-red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Bankroll curve */}
        <div className="lg:col-span-2">
          <SectionTitle>Bankroll Curve (30d)</SectionTitle>
          <div className="bg-terminal-surface border border-terminal-border rounded p-3">
            <div className="flex items-center gap-4 mb-3 font-mono text-2xs">
              <span className="text-green">ROI: +{(summary.roi ?? 0).toFixed(1)}%</span>
              <span className="text-terminal-dim">·</span>
              <span>Win Rate: {(summary.winRate ?? 0).toFixed(1)}%</span>
              <span className="text-terminal-dim">·</span>
              <span>Avg Edge: +{(summary.avgEdge ?? 0).toFixed(1)}%</span>
              <span className="text-terminal-dim">·</span>
              <span className="text-red">Max DD: -{(summary.maxDrawdownPct ?? 0).toFixed(1)}%</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1e2a3a' }} interval={4} />
                <YAxis tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1e2a3a' }} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="balance" stroke="#00e5a0" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* P&L by surface */}
        <div>
          <SectionTitle>P&L by Surface</SectionTitle>
          <div className="bg-terminal-surface border border-terminal-border rounded p-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={surfaceData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                <XAxis dataKey="surf" tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1e2a3a' }} />
                <YAxis tick={{ fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1e2a3a' }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pnl" fill="#4a9eff" radius={[2, 2, 0, 0]}
                  label={{ position: 'top', fontSize: 9, fill: '#3a5060', fontFamily: 'JetBrains Mono', formatter: (v: number) => `$${v.toFixed(1)}` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Open bets */}
      {openBets.length > 0 && (
        <>
          <SectionTitle>Open Bets</SectionTitle>
          <div className="space-y-1.5 mb-4">
            {openBets.map((b: any) => (
              <div key={b.id} className="bg-terminal-surface border border-terminal-border rounded p-2.5 flex items-center gap-3">
                <StatusDot status="OPEN" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-terminal-text">{b.playerName}</div>
                  <div className="font-mono text-2xs text-terminal-dim">
                    {b.matchDesc}
                    
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs text-amber font-bold">${b.stake.toFixed(2)} @ {b.odds}</div>
                  <div className="mt-0.5 flex items-center gap-1 justify-end">
                    <SignalPill signal={b.signal as Signal} />
                    <span className="font-mono text-2xs text-terminal-dim">Edge: {(b.edge * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Settled bets */}
      <SectionTitle>Settled Bets</SectionTitle>
      <div className="space-y-1.5">
        {settledBets.map((b: any) => (
          <div key={b.id} className="bg-terminal-surface border border-terminal-border rounded p-2.5 flex items-center gap-3">
            <StatusDot status={b.result ?? 'OPEN'} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-terminal-text">{b.playerName}</div>
              <div className="font-mono text-2xs text-terminal-dim">
                {b.matchDesc}
                
                · Stake: ${b.stake.toFixed(2)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-mono text-xs font-bold ${(b.pnl ?? 0) >= 0 ? 'text-green' : 'text-red'}`}>
                {(b.pnl ?? 0) >= 0 ? '+' : ''}${Math.abs(b.pnl ?? 0).toFixed(2)}
              </div>
              <div className="mt-0.5 flex items-center gap-1 justify-end">
                <SignalPill signal={b.signal as Signal} />
                <span className="font-mono text-2xs text-terminal-dim">Edge: {(b.edge * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
