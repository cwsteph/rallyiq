// src/lib/editorial/theme.ts
// Shared design tokens for the "The Read" editorial theme, used across every page.
// Single source of truth for the palette, fonts, and accents (mirrors MatchRead.tsx).

export const C = {
  bg: '#f3ede2', paper: '#fffdf8', ink: '#1d1a15', body: '#3c3730',
  muted: '#857c6e', faint: '#a89f90', line: '#e6ddcf', line2: '#d8cdb9',
  green: '#1f8a5b', red: '#c0392b', gold: '#b08828',
} as const

// Default brand accent for non-match pages (warm clay terracotta).
export const BRAND = '#d9763f'

// Per-surface accents (match pages override the brand accent with these).
export const SURFACE: Record<string, { accent: string; glow: string; wash: string }> = {
  Clay:  { accent: '#d9763f', glow: 'rgba(217,118,63,0.16)', wash: 'rgba(217,118,63,0.07)' },
  Hard:  { accent: '#4a9eff', glow: 'rgba(74,158,255,0.16)', wash: 'rgba(74,158,255,0.07)' },
  Grass: { accent: '#3fb96a', glow: 'rgba(63,185,106,0.16)', wash: 'rgba(63,185,106,0.07)' },
}

export const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
export const sans = { fontFamily: "'DM Sans', system-ui, sans-serif" } as const
export const mono = { fontFamily: "'IBM Plex Mono', monospace" } as const

export const fmtPct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`
export const fmtSignedPct = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`

// Signal → colour (BET green, LEAN gold, PASS faint).
export const signalColor = (s: string) => (s === 'BET' ? C.green : s === 'LEAN' ? C.gold : C.faint)

// Edge → colour (≥5% green, ≥2% gold, else faint).
export const edgeColor = (e: number) => (e >= 0.05 ? C.green : e >= 0.02 ? C.gold : C.faint)
