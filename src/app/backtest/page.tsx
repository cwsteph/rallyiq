// src/app/backtest/page.tsx — Backtest results, editorial "The Read" theme.
'use client'
import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  Container, Card, SectionLabel, Stat, SignalPill, SurfaceTag,
  C, BRAND, serif, mono,
} from '@/components/editorial/ui'

const axisTick = { fontSize: 9, fill: C.faint, fontFamily: "'IBM Plex Mono', monospace" }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div style={{ ...mono, fontSize: 11, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, padding: '6px 9px' }}>
      <div style={{ color: C.faint }}>Bet #{payload[0]?.payload?.i}</div>
      <div style={{ color: v >= 0 ? C.green : C.red, fontWeight: 700 }}>
        P&amp;L: {v >= 0 ? '+' : ''}${v?.toFixed(2)}
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  ...mono, fontSize: 11, color: C.body, background: C.paper,
  border: `1px solid ${C.line2}`, borderRadius: 4, padding: '6px 10px', cursor: 'pointer',
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

  const betRows = rows.filter((r: any) => r.signal !== 'PASS')

  return (
    <Container>
      {/* Lede */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>RallyIQ · The Backtest</div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>Backtest</h1>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        <select value={surface} onChange={e => setSurface(e.target.value)} style={selectStyle}>
          <option value="all">All Surfaces</option>
          <option value="Hard">Hard</option>
          <option value="Clay">Clay</option>
          <option value="Grass">Grass</option>
        </select>
        <select value={minEdge} onChange={e => setMinEdge(e.target.value)} style={selectStyle}>
          <option value="0.02">Min edge 2%</option>
          <option value="0.03">Min edge 3%</option>
          <option value="0.05">Min edge 5%</option>
          <option value="0.08">Min edge 8%</option>
        </select>
        <span style={{ ...mono, fontSize: 11, color: C.faint, letterSpacing: 0.5 }}>
          {loading ? 'Loading…' : `${summary.totalBets ?? 0} qualifying bets`}
        </span>
      </div>

      {/* Headline metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 26 }}>
        <Card style={{ padding: 18 }}>
          <Stat label="Total Bets" value={String(summary.totalBets ?? 0)} />
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat
            label="Win Rate"
            value={`${(summary.winRate ?? 0).toFixed(1)}%`}
            sub={`${summary.wins ?? 0}W / ${(summary.totalBets ?? 0) - (summary.wins ?? 0)}L`}
          />
        </Card>
        <Card style={{ padding: 18 }} accentRail={pnlPositive ? C.green : C.red}>
          <Stat
            label="Total P&L"
            value={`${pnlPositive ? '+' : ''}$${(summary.totalPnl ?? 0).toFixed(2)}`}
            valueColor={pnlPositive ? C.green : C.red}
          />
        </Card>
        <Card style={{ padding: 18 }} accentRail={roiPositive ? C.green : C.red}>
          <Stat
            label="ROI"
            value={`${roiPositive ? '+' : ''}${(summary.roi ?? 0).toFixed(1)}%`}
            valueColor={roiPositive ? C.green : C.red}
            sub="per unit staked"
          />
        </Card>
        <Card style={{ padding: 18 }}>
          <Stat
            label="Min Edge Filter"
            value={`${(parseFloat(minEdge) * 100).toFixed(0)}%`}
            sub="threshold"
            valueColor={C.gold}
          />
        </Card>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 26 }}>
        <div>
          <SectionLabel>Cumulative P&amp;L Curve</SectionLabel>
          <Card style={{ padding: 14 }}>
            {curve.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis
                    dataKey="i"
                    tick={axisTick}
                    tickLine={false} axisLine={{ stroke: C.line2 }}
                    interval={Math.max(1, Math.floor(curve.length / 5))}
                  />
                  <YAxis
                    tick={axisTick}
                    tickLine={false} axisLine={{ stroke: C.line2 }}
                    tickFormatter={v => `$${v.toFixed(0)}`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.line2 }} />
                  <Line type="monotone" dataKey="pnl" stroke={BRAND} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ ...mono, fontSize: 12, color: C.faint, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                {loading ? 'Computing…' : 'No completed matches yet — run npm run db:seed'}
              </div>
            )}
          </Card>
        </div>

        <div>
          <SectionLabel>ROI by Surface</SectionLabel>
          <Card style={{ padding: 14 }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={surfaceStats} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="surface" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: C.line2 }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={{ stroke: C.line2 }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  cursor={{ fill: C.bg }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div style={{ ...mono, fontSize: 11, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, padding: '6px 9px' }}>
                        <div style={{ color: C.faint }}>{payload[0]?.payload?.surface}</div>
                        <div style={{ color: payload[0]?.value >= 0 ? C.green : C.red, fontWeight: 700 }}>
                          ROI: {payload[0]?.value}%
                        </div>
                        <div style={{ color: C.muted }}>n={payload[0]?.payload?.n}</div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="roi" radius={[3, 3, 0, 0]}>
                  {surfaceStats.map((s: any) => (
                    <Cell
                      key={s.surface}
                      fill={s.roi >= 0 ? 'rgba(31,138,91,0.18)' : 'rgba(192,57,43,0.18)'}
                      stroke={s.roi >= 0 ? C.green : C.red}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Edge buckets */}
      <SectionLabel>ROI by Edge Bucket</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 26 }}>
        {edgeBuckets.map((b: any) => (
          <Card key={b.label} style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>{b.label}</div>
            <div style={{ ...serif, fontSize: 28, fontWeight: 600, color: b.roi >= 0 ? C.green : C.red, lineHeight: 1.1 }}>
              {b.roi >= 0 ? '+' : ''}{b.roi}%
            </div>
            <div style={{ ...mono, fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>
              <div>n={b.n} · {b.wins}W · {b.winRate}% WR</div>
              <div style={{ color: b.pnl >= 0 ? C.green : C.red, fontWeight: 600 }}>
                {b.pnl >= 0 ? '+' : ''}${b.pnl.toFixed(2)} P&amp;L
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bet log */}
      <SectionLabel right={<span style={{ ...mono, fontSize: 10, color: C.faint }}>{betRows.length} bets</span>}>Bet Log</SectionLabel>
      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Match', 'Surf', 'Model%', 'Impl%', 'Edge', 'Signal', 'Odds', 'Result', 'P&L'].map(h => (
                <th key={h} style={{ ...mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: C.faint, textAlign: 'left', padding: '12px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.line2}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {betRows.map((r: any, i: number) => (
              <tr key={r.matchId} style={{ borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                <td style={{ ...mono, fontSize: 11, color: C.muted, padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {new Date(r.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td style={{ ...serif, fontSize: 14, fontWeight: 600, color: C.ink, padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {r.p1Name.split(' ').pop()} <span style={{ ...serif, fontStyle: 'italic', color: C.faint, fontSize: 12 }}>v</span> {r.p2Name.split(' ').pop()}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <SurfaceTag surface={r.surface as string} />
                </td>
                <td style={{ ...mono, fontSize: 12, color: C.green, padding: '10px 14px' }}>
                  {(r.modelProb * 100).toFixed(1)}%
                </td>
                <td style={{ ...mono, fontSize: 12, color: C.muted, padding: '10px 14px' }}>
                  {(r.impliedProb * 100).toFixed(1)}%
                </td>
                <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: r.edge >= 0.05 ? C.green : r.edge >= 0.02 ? C.gold : C.faint, padding: '10px 14px' }}>
                  +{(r.edge * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <SignalPill signal={r.signal as string} />
                </td>
                <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: C.body, padding: '10px 14px' }}>
                  {r.odds.toFixed(2)}
                </td>
                <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: r.betWon === null ? C.faint : r.betWon ? C.green : C.red, padding: '10px 14px' }}>
                  {r.betWon === null ? '—' : r.betWon ? 'WIN' : 'LOSS'}
                </td>
                <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: r.pnl >= 0 ? C.green : C.red, padding: '10px 14px' }}>
                  {r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Container>
  )
}
