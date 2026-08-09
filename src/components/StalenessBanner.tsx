// src/components/StalenessBanner.tsx
// Server component. Reads the health file this repo publishes on every
// successful refresh and says plainly when the data underneath the page is old.
//
// This is the honesty floor of the refresh layer: it works even when the
// workflow, the alerting and the deploy have all failed, because it reads a
// committed file rather than asking anything to be running.

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { C } from '@/lib/editorial/theme'
import { evaluateHealth, type Health } from '@/lib/health'

export function readHealth(): Health | null {
  const p = path.join(process.cwd(), 'data', 'health.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

export function StalenessBanner() {
  const verdict = evaluateHealth(readHealth())
  if (verdict.worst === 'ok') return null

  const dead = verdict.worst === 'dead'
  return (
    <div
      role="status"
      style={{
        background: dead ? 'rgba(192,57,43,0.10)' : 'rgba(176,136,40,0.12)',
        borderBottom: `1px solid ${dead ? C.red : C.gold}`,
        color: C.ink,
        padding: '10px 20px',
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 13,
        letterSpacing: '0.01em',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dead ? C.red : C.gold,
          flexShrink: 0,
        }}
      />
      <span>{verdict.message}</span>
    </div>
  )
}
