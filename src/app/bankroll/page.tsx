// src/app/bankroll/page.tsx — Bankroll ("The Ledger"), editorial theme.
'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Container, Card, SectionLabel, Stat, SignalPill, C, BRAND, mono, serif } from '@/components/editorial/ui'
import { SURFACE } from '@/lib/editorial/theme'
import type { Signal } from '@/types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ ...mono, fontSize: 11, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 3, padding: '5px 8px' }}>
      <div style={{ color: C.faint, marginBottom: 2 }}>{label}</div>
      <div style={{ color: C.green, fontWeight: 700 }}>${payload[0]?.value?.toFixed(2)}</div>
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

  if (loading) return (
    <Container>
      <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '48px 0' }}>Loading…</div>
    </Container>
  )

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

  const totalPnl = summary.totalPnl ?? 0

  const metrics = [
    { label: 'Bankroll', value: `$${(summary.current ?? 100).toFixed(2)}`, sub: `+${(summary.roi ?? 0).toFixed(1)}% ROI`, color: C.green },
    { label: 'Open Bets', value: String(summary.openBets ?? 0), sub: `$${openBets.reduce((s: number, b: any) => s + b.stake, 0).toFixed(2)} at risk`, color: C.gold },
    { label: 'Settled P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, sub: `${summary.wins ?? 0}W · ${summary.losses ?? 0}L · ${summary.totalBets ?? 0} total`, color: totalPnl >= 0 ? C.green : C.red },
    { label: 'Max Drawdown', value: `-$${(summary.maxDrawdown ?? 0).toFixed(2)}`, sub: `-${(summary.maxDrawdownPct ?? 0).toFixed(1)}% from peak`, color: C.red },
  ]

  const gridTick = { fontSize: 9, fill: C.faint, fontFamily: "'IBM Plex Mono', monospace" }

  return (
    <Container>
      {/* Lede */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>RallyIQ · The Ledger</div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>Bankroll &amp; performance</h1>
      </div>

      {/* Metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 26 }}>
        {metrics.map(mt => (
          <Card key={mt.label} style={{ padding: 18 }} accentRail={mt.color}>
            <Stat label={mt.label} value={mt.value} sub={mt.sub} valueColor={mt.color} />
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28, marginBottom: 30 }}>
        {/* Bankroll curve */}
        <div>
          <SectionLabel>Bankroll Curve · 30d</SectionLabel>
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14, ...mono, fontSize: 11 }}>
              <span style={{ color: C.green, fontWeight: 700 }}>ROI: +{(summary.roi ?? 0).toFixed(1)}%</span>
              <span style={{ color: C.faint }}>·</span>
              <span style={{ color: C.body }}>Win Rate: {(summary.winRate ?? 0).toFixed(1)}%</span>
              <span style={{ color: C.faint }}>·</span>
              <span style={{ color: C.gold }}>Avg Edge: +{(summary.avgEdge ?? 0).toFixed(1)}%</span>
              <span style={{ color: C.faint }}>·</span>
              <span style={{ color: C.red }}>Max DD: -{(summary.maxDrawdownPct ?? 0).toFixed(1)}%</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis dataKey="date" tick={gridTick} tickLine={false} axisLine={{ stroke: C.line2 }} interval={4} />
                <YAxis tick={gridTick} tickLine={false} axisLine={{ stroke: C.line2 }} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.line2 }} />
                <Line type="monotone" dataKey="balance" stroke={BRAND} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* P&L by surface */}
        <div>
          <SectionLabel>P&L by Surface</SectionLabel>
          <Card style={{ padding: 18 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={surfaceData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="surf" tick={gridTick} tickLine={false} axisLine={{ stroke: C.line2 }} />
                <YAxis tick={gridTick} tickLine={false} axisLine={{ stroke: C.line2 }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: C.line }} />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}
                  fill={SURFACE.Hard.accent}
                  label={{ position: 'top', fontSize: 9, fill: C.muted, fontFamily: "'IBM Plex Mono', monospace", formatter: (v: number) => `$${v.toFixed(1)}` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Open bets */}
      {openBets.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <SectionLabel accent={C.gold}>Open Bets</SectionLabel>
          <Card style={{ padding: 4 }}>
            {openBets.map((b: any, i: number) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: C.gold, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...serif, fontSize: 16, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.playerName}</div>
                  <div style={{ ...mono, fontSize: 10, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.matchDesc}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: C.gold }}>${b.stake.toFixed(2)} @ {b.odds}</div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <SignalPill signal={b.signal as Signal} />
                    <span style={{ ...mono, fontSize: 10, color: C.faint }}>Edge: {(b.edge * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Settled bets */}
      <SectionLabel>Settled Bets</SectionLabel>
      <Card style={{ padding: 4 }}>
        {settledBets.map((b: any, i: number) => {
          const won = (b.pnl ?? 0) >= 0
          return (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: won ? C.green : C.red, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...serif, fontSize: 16, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.playerName}</div>
                <div style={{ ...mono, fontSize: 10, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.matchDesc} · Stake: ${b.stake.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: won ? C.green : C.red }}>
                  {won ? '+' : ''}${Math.abs(b.pnl ?? 0).toFixed(2)}
                </div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <SignalPill signal={b.signal as Signal} />
                  <span style={{ ...mono, fontSize: 10, color: C.faint }}>Edge: {(b.edge * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )
        })}
        {settledBets.length === 0 && (
          <div style={{ ...mono, fontSize: 12, color: C.faint, textAlign: 'center', padding: '32px 0' }}>No settled bets yet</div>
        )}
      </Card>
    </Container>
  )
}
