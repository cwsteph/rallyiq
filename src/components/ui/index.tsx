// src/components/ui/index.tsx
import { type ReactNode } from 'react'
import type { Signal, Surface } from '@/types'

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-terminal-surface border border-terminal-border rounded p-3 ${className}`}>
      {children}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="font-mono text-2xs text-terminal-dim uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-terminal-border" />
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
export function MetricCard({
  label, value, sub, valueClass = 'text-terminal-text',
}: {
  label: string; value: string | number; sub?: string; valueClass?: string
}) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-2.5">
      <div className="font-mono text-2xs text-terminal-dim uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono font-bold text-2xl leading-none ${valueClass}`}>{value}</div>
      {sub && <div className="font-mono text-2xs text-terminal-dim mt-1">{sub}</div>}
    </div>
  )
}

// ── Signal pill ───────────────────────────────────────────────────────────────
export function SignalPill({ signal }: { signal: Signal }) {
  const styles: Record<Signal, string> = {
    BET:  'bg-green-bg text-green border-green/30',
    LEAN: 'bg-amber-bg text-amber border-amber/30',
    PASS: 'bg-terminal-border/20 text-terminal-dim border-terminal-border',
  }
  return (
    <span className={`inline-block font-mono text-2xs px-2 py-0.5 rounded border uppercase tracking-widest ${styles[signal]}`}>
      {signal}
    </span>
  )
}

// ── Edge badge ────────────────────────────────────────────────────────────────
export function EdgeBadge({ edge, signal }: { edge: number; signal: Signal }) {
  const styles: Record<Signal, string> = {
    BET:  'bg-green-bg text-green border-green/30',
    LEAN: 'bg-amber-bg text-amber border-amber/30',
    PASS: 'bg-terminal-border/20 text-terminal-dim border-terminal-border',
  }
  return (
    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${styles[signal]}`}>
      {edge >= 0 ? '+' : ''}{(edge * 100).toFixed(1)}%
    </span>
  )
}

// ── Surface badge ─────────────────────────────────────────────────────────────
export function SurfaceBadge({ surface }: { surface: Surface }) {
  const styles: Record<Surface, string> = {
    Hard:   'bg-blue-bg text-blue',
    Clay:   'bg-[#2a1508] text-[#cc7a44]',
    Grass:  'bg-[#0a200f] text-[#44cc7a]',
    Carpet: 'bg-terminal-border/20 text-terminal-muted',
  }
  return (
    <span className={`font-mono text-2xs px-1.5 py-0.5 rounded uppercase tracking-widest ${styles[surface]}`}>
      {surface}
    </span>
  )
}

// ── Prob bar ──────────────────────────────────────────────────────────────────
export function ProbBar({ prob1, p1Name, p2Name }: { prob1: number; p1Name: string; p2Name: string }) {
  return (
    <div>
      <div className="h-1 bg-terminal-border rounded overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green to-blue rounded transition-all duration-500"
          style={{ width: `${(prob1 * 100).toFixed(0)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-2xs text-green">{(prob1 * 100).toFixed(1)}%</span>
        <span className="font-mono text-2xs text-terminal-dim">{((1 - prob1) * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
export function Sparkline({ form }: { form: number[] }) {
  return (
    <span className="inline-flex items-end gap-0.5 h-4">
      {form.slice(0, 10).map((v, i) => (
        <span
          key={i}
          style={{ height: v ? '14px' : '5px' }}
          className={`w-1 rounded-sm ${v ? 'bg-green' : 'bg-red'}`}
        />
      ))}
    </span>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────
export function StatusDot({ status }: { status: 'WIN' | 'LOSS' | 'OPEN' | 'PUSH' }) {
  const styles = {
    WIN:  'bg-green',
    LOSS: 'bg-red',
    OPEN: 'bg-amber animate-pulse',
    PUSH: 'bg-terminal-muted',
  }
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles[status]}`} />
}

// ── Kelly meter ───────────────────────────────────────────────────────────────
export function KellyMeter({ fraction }: { fraction: number }) {
  const pct = Math.min(100, fraction * 400)
  const color = pct > 60 ? 'bg-amber' : 'bg-green'
  return (
    <div className="h-1 bg-terminal-border rounded overflow-hidden">
      <div className={`h-full ${color} rounded transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}
