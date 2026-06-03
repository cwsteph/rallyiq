// src/components/editorial/ui.tsx
// Presentational building blocks for the editorial theme. Server-safe (no hooks).
import type { ReactNode, CSSProperties } from 'react'
import { C, BRAND, SURFACE, serif, sans, mono, fmtSignedPct, signalColor, edgeColor } from '@/lib/editorial/theme'

export { C, BRAND, serif, sans, mono }

/** Centered max-width page container on the editorial canvas. */
export function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 28px 44px', ...style }}>{children}</div>
}

/** Paper card. */
export function Card({ children, style, accentRail }: { children: ReactNode; style?: CSSProperties; accentRail?: string }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 22, ...style }}>
      {accentRail && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accentRail }} />}
      {children}
    </div>
  )
}

/** Section eyebrow label with a rule underneath. */
export function SectionLabel({ children, accent = BRAND, right }: { children: ReactNode; accent?: string; right?: ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: accent, fontWeight: 600, marginBottom: 14, borderBottom: `1px solid ${C.line2}`, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  )
}

/** Big stat block: small mono label over a serif value, optional sub. */
export function Stat({ label, value, sub, valueColor = C.ink, accent }: { label: string; value: ReactNode; sub?: ReactNode; valueColor?: string; accent?: string }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: C.faint }}>{label}</div>
      <div style={{ ...serif, fontSize: 30, fontWeight: 600, color: accent ?? valueColor, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ ...mono, fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/** Signal pill (BET / LEAN / PASS). */
export function SignalPill({ signal }: { signal: string }) {
  const col = signalColor(signal)
  return (
    <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: col, border: `1px solid ${col}`, borderRadius: 99, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {signal}
    </span>
  )
}

/** Edge pill (+x.x%), coloured by magnitude. */
export function EdgePill({ edge }: { edge: number }) {
  const col = edgeColor(edge)
  return <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: col }}>{fmtSignedPct(edge, 1)}</span>
}

/** Surface tag chip. */
export function SurfaceTag({ surface }: { surface: string }) {
  const acc = (SURFACE[surface] ?? SURFACE.Hard).accent
  const wash = (SURFACE[surface] ?? SURFACE.Hard).wash
  return (
    <span style={{ ...mono, fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: acc, background: wash, border: `1px solid ${acc}`, borderRadius: 3, padding: '1px 6px' }}>
      {surface}
    </span>
  )
}

/** Win-probability split bar for two players. */
export function ProbSplit({ prob1, name1, name2, accent = BRAND }: { prob1: number; name1?: string; name2?: string; accent?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: C.line }}>
        <div style={{ width: `${prob1 * 100}%`, background: accent }} />
        <div style={{ flex: 1, background: C.line2 }} />
      </div>
      {(name1 || name2) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ ...mono, fontSize: 11, color: accent, fontWeight: 600 }}>{name1} {(prob1 * 100).toFixed(1)}%</span>
          <span style={{ ...mono, fontSize: 11, color: C.muted, fontWeight: 600 }}>{name2} {((1 - prob1) * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

/** Recent-form pips (1 = win, 0 = loss). */
export function FormStrip({ form, win = C.green, loss = C.red }: { form: number[]; win?: string; loss?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end' }}>
      {form.slice(0, 10).map((v, i) => (
        <span key={i} style={{ width: 7, height: v ? 14 : 7, borderRadius: 2, background: v ? win : loss, opacity: v ? 1 : 0.55 }} />
      ))}
    </span>
  )
}
