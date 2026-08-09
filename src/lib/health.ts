// src/lib/health.ts
// Pure staleness evaluation, shared by the banner component and its tests.
//
// Deliberately free of JSX, path aliases and node built-ins so it can be
// imported both by the Next build and directly by `node --test`.

export type FeedStatus = 'ok' | 'stale' | 'dead'

export interface Feed {
  lastSuccess: string
  records: number
  maxAgeHours: number
}

export interface Health {
  app: string
  generated: string
  feeds: Record<string, Feed>
}

export interface HealthVerdict {
  worst: FeedStatus
  suppressSignals: boolean
  message: string
}

/**
 * Status is recomputed from the current time, never read from the file. A
 * health file written a month ago still claims every feed was "ok" then, which
 * is precisely the reassurance that hid ten weeks of stale data.
 *
 * Two stages: past `maxAgeHours` the app says "data as of <date>"; past double
 * it, the app stops emitting BET/LEAN rather than pricing edges off dead data.
 */
export function evaluateHealth(health: Health | null, nowMs: number = Date.now()): HealthVerdict {
  if (!health?.feeds || Object.keys(health.feeds).length === 0) {
    return {
      worst: 'dead',
      suppressSignals: true,
      message: 'No health data published — the refresh pipeline has not reported in.',
    }
  }

  const rank: Record<FeedStatus, number> = { ok: 0, stale: 1, dead: 2 }
  let worst: FeedStatus = 'ok'
  let oldest: { name: string; ageHours: number; asOf: string } | null = null

  for (const [name, f] of Object.entries(health.feeds)) {
    const ts = Date.parse(f.lastSuccess)
    // An unparseable timestamp counts as dead, never skipped — skipping it
    // would let a corrupt field read as healthy.
    const ageHours = Number.isNaN(ts) ? Infinity : (nowMs - ts) / 3_600_000

    let status: FeedStatus = 'ok'
    if (ageHours > f.maxAgeHours * 2) status = 'dead'
    else if (ageHours > f.maxAgeHours) status = 'stale'

    if (rank[status] > rank[worst]) worst = status
    if (!oldest || ageHours > oldest.ageHours) {
      oldest = { name, ageHours, asOf: Number.isNaN(ts) ? 'unknown' : f.lastSuccess.slice(0, 10) }
    }
  }

  if (worst === 'ok') return { worst, suppressSignals: false, message: '' }

  const age = Number.isFinite(oldest!.ageHours) ? `${Math.floor(oldest!.ageHours)}h` : 'an unknown time'
  return {
    worst,
    suppressSignals: worst === 'dead',
    message:
      worst === 'stale'
        ? `Data as of ${oldest!.asOf}. The ${oldest!.name} feed has not refreshed in ${age}.`
        // Says only what is true. `suppressSignals` is computed and tested, but
        // nothing consumes it yet — gating computeEdge means editing
        // src/lib/betting/edge.ts, which currently holds uncommitted work.
        // Promising suppression the code does not perform would be the same
        // class of lie as a green workflow that fetched nothing.
        : `Data as of ${oldest!.asOf}. The ${oldest!.name} feed is more than twice past its refresh window — treat any edge on this page as unpriced.`,
  }
}
