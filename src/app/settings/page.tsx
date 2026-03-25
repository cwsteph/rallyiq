// src/app/settings/page.tsx
'use client'
import { useState } from 'react'
import { Card, SectionTitle, MetricCard } from '@/components/ui'

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

  return (
    <div className="max-w-xl">
      <SectionTitle>Bankroll Settings</SectionTitle>
      <Card className="mb-4 space-y-4">
        {[
          { label: 'Starting Bankroll ($)', value: startBankroll, set: setStartBankroll, hint: 'Initial capital for ROI calculation' },
          { label: 'Max Bet Size (% of bankroll)', value: maxBetPct, set: setMaxBetPct, hint: 'Hard cap per bet regardless of Kelly' },
          { label: 'Min Edge to BET (%)', value: minEdge, set: setMinEdge, hint: 'Edge threshold for BET signal (LEAN = half this)' },
          { label: 'Kelly Fraction (%)', value: kellyFraction, set: setKellyFraction, hint: '25% = quarter Kelly (conservative/recommended)' },
        ].map(field => (
          <div key={field.label}>
            <label className="block font-mono text-2xs text-terminal-dim uppercase tracking-widest mb-1.5">
              {field.label}
            </label>
            <input
              type="number"
              value={field.value}
              onChange={e => field.set(e.target.value)}
              className="w-full bg-terminal border border-terminal-border text-terminal-text font-mono text-sm px-3 py-2 rounded focus:outline-none focus:border-green/50"
            />
            <div className="font-mono text-2xs text-terminal-dim mt-1">{field.hint}</div>
          </div>
        ))}

        <button
          onClick={handleSave}
          className={`w-full py-2 rounded font-mono text-xs font-bold transition-colors ${
            saved
              ? 'bg-green-bg text-green border border-green/30'
              : 'bg-terminal-surface border border-terminal-border text-terminal-muted hover:border-terminal-hover hover:text-terminal-text'
          }`}
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </Card>

      <SectionTitle>Model Weights</SectionTitle>
      <Card className="mb-4">
        <div className="font-mono text-2xs text-terminal-dim mb-3">
          Current weighting (must sum to 100%)
        </div>
        {[
          { label: 'Surface Elo',   weight: 35, color: 'bg-green' },
          { label: 'Overall Elo',   weight: 20, color: 'bg-blue' },
          { label: 'Recent Form',   weight: 20, color: 'bg-amber' },
          { label: 'Serve/Return',  weight: 15, color: 'bg-blue/60' },
          { label: 'Fatigue',       weight: 10, color: 'bg-terminal-muted' },
        ].map(w => (
          <div key={w.label} className="flex items-center gap-3 mb-2">
            <span className="font-mono text-2xs text-terminal-dim w-28">{w.label}</span>
            <div className="flex-1 h-1.5 bg-terminal-border rounded overflow-hidden">
              <div className={`h-full ${w.color} rounded`} style={{ width: `${w.weight * 2}%` }} />
            </div>
            <span className="font-mono text-xs text-terminal-text w-8 text-right">{w.weight}%</span>
          </div>
        ))}
        <div className="font-mono text-2xs text-terminal-dim mt-3">
          Edit weights in <code className="text-blue">/src/lib/model/probability.ts</code>
        </div>
      </Card>

      <SectionTitle>Data Sources</SectionTitle>
      <Card className="space-y-2">
        {[
          { name: 'Jeff Sackmann ATP', status: 'active', url: 'github.com/JeffSackmann/tennis_atp' },
          { name: 'Jeff Sackmann WTA', status: 'active', url: 'github.com/JeffSackmann/tennis_wta' },
          { name: 'Tennis-Data Odds',  status: 'inactive', url: 'tennis-data.co.uk' },
          { name: 'The Odds API',      status: 'planned',  url: 'the-odds-api.com' },
          { name: 'Tennis Abstract',   status: 'planned',  url: 'tennisabstract.com' },
        ].map(s => (
          <div key={s.name} className="flex items-center justify-between py-1.5 border-b border-terminal-border last:border-0">
            <div>
              <div className="text-sm text-terminal-text">{s.name}</div>
              <div className="font-mono text-2xs text-terminal-dim">{s.url}</div>
            </div>
            <span className={`font-mono text-2xs px-2 py-0.5 rounded uppercase tracking-widest border ${
              s.status === 'active'
                ? 'bg-green-bg text-green border-green/30'
                : s.status === 'planned'
                ? 'bg-terminal-border/20 text-terminal-dim border-terminal-border'
                : 'bg-amber-bg text-amber border-amber/30'
            }`}>
              {s.status}
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}
