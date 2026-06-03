// src/app/settings/page.tsx — Settings, editorial theme.
'use client'
import { useState } from 'react'
import { Container, Card, SectionLabel, C, BRAND, serif, mono, sans } from '@/components/editorial/ui'

export default function SettingsPage() {
  const [startBankroll, setStartBankroll] = useState('100')
  const [maxBetPct, setMaxBetPct] = useState('2')
  const [minEdge, setMinEdge] = useState('5')
  const [kellyFraction, setKellyFraction] = useState('25')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // In a real app, persist to DB or localStorage
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const labelStyle = {
    ...mono,
    display: 'block',
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: C.faint,
    marginBottom: 6,
  }
  const hintStyle = { ...mono, fontSize: 11, color: C.muted, marginTop: 5 }

  const weights = [
    { label: 'Surface Elo',  weight: 35, color: C.green },
    { label: 'Overall Elo',  weight: 20, color: BRAND },
    { label: 'Recent Form',  weight: 20, color: C.gold },
    { label: 'Serve/Return', weight: 15, color: '#4a9eff' },
    { label: 'Fatigue',      weight: 10, color: C.muted },
  ]

  const sources = [
    { name: 'Jeff Sackmann ATP', status: 'active', url: 'github.com/JeffSackmann/tennis_atp' },
    { name: 'Jeff Sackmann WTA', status: 'active', url: 'github.com/JeffSackmann/tennis_wta' },
    { name: 'Tennis-Data Odds',  status: 'inactive', url: 'tennis-data.co.uk' },
    { name: 'The Odds API',      status: 'planned',  url: 'the-odds-api.com' },
    { name: 'Tennis Abstract',   status: 'planned',  url: 'tennisabstract.com' },
  ]

  const statusStyle = (status: string) => {
    const col = status === 'active' ? C.green : status === 'planned' ? C.gold : C.faint
    return {
      ...mono,
      fontSize: 9,
      fontWeight: 600 as const,
      letterSpacing: 1.5,
      textTransform: 'uppercase' as const,
      color: col,
      border: `1px solid ${col}`,
      borderRadius: 3,
      padding: '2px 8px',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <Container style={{ maxWidth: 640 }}>
      {/* Lede */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>RallyIQ · Configuration</div>
        <h1 style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, letterSpacing: -0.6, margin: '4px 0 0' }}>Settings</h1>
      </div>

      {/* Bankroll Settings */}
      <Card style={{ marginBottom: 18 }}>
        <SectionLabel>Bankroll Settings</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Starting Bankroll ($)', value: startBankroll, set: setStartBankroll, hint: 'Initial capital for ROI calculation' },
            { label: 'Max Bet Size (% of bankroll)', value: maxBetPct, set: setMaxBetPct, hint: 'Hard cap per bet regardless of Kelly' },
            { label: 'Min Edge to BET (%)', value: minEdge, set: setMinEdge, hint: 'Edge threshold for BET signal (LEAN = half this)' },
            { label: 'Kelly Fraction (%)', value: kellyFraction, set: setKellyFraction, hint: '25% = quarter Kelly (conservative/recommended)' },
          ].map(field => (
            <div key={field.label}>
              <label style={labelStyle}>{field.label}</label>
              <input
                type="number"
                value={field.value}
                onChange={e => field.set(e.target.value)}
                style={{
                  ...mono,
                  width: '100%',
                  boxSizing: 'border-box',
                  background: C.paper,
                  border: `1px solid ${C.line2}`,
                  color: C.ink,
                  fontSize: 14,
                  padding: '9px 11px',
                  borderRadius: 4,
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = BRAND }}
                onBlur={e => { e.currentTarget.style.borderColor = C.line2 }}
              />
              <div style={hintStyle}>{field.hint}</div>
            </div>
          ))}

          <button
            onClick={handleSave}
            style={{
              ...mono,
              width: '100%',
              padding: '10px 0',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              background: saved ? 'rgba(31,138,91,0.10)' : BRAND,
              color: saved ? C.green : C.paper,
              border: `1px solid ${saved ? C.green : BRAND}`,
            }}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </Card>

      {/* Model Weights */}
      <Card style={{ marginBottom: 18 }}>
        <SectionLabel>Model Weights</SectionLabel>
        <div style={{ ...mono, fontSize: 11, color: C.muted, marginBottom: 14 }}>
          Current weighting (must sum to 100%)
        </div>
        {weights.map(w => (
          <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ ...mono, fontSize: 10, color: C.muted, width: 112, textTransform: 'uppercase', letterSpacing: 0.5 }}>{w.label}</span>
            <div style={{ flex: 1, height: 6, background: C.line, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: w.color, borderRadius: 99, width: `${w.weight * 2}%` }} />
            </div>
            <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: C.ink, width: 32, textAlign: 'right' }}>{w.weight}%</span>
          </div>
        ))}
        <div style={{ ...mono, fontSize: 11, color: C.muted, marginTop: 14 }}>
          Edit weights in <code style={{ ...mono, color: BRAND }}>/src/lib/model/probability.ts</code>
        </div>
      </Card>

      {/* Data Sources */}
      <Card>
        <SectionLabel>Data Sources</SectionLabel>
        {sources.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0',
              borderTop: i ? `1px solid ${C.line}` : 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ ...sans, fontSize: 14, color: C.ink, fontWeight: 500 }}>{s.name}</div>
              <div style={{ ...mono, fontSize: 11, color: C.faint }}>{s.url}</div>
            </div>
            <span style={statusStyle(s.status)}>{s.status}</span>
          </div>
        ))}
      </Card>
    </Container>
  )
}
