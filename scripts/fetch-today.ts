// scripts/fetch-today.ts
// Fetches today's ATP + WTA singles matches from ESPN's free public API
// No API key needed. No rate limits for reasonable usage.
//
// Run:  npx tsx scripts/fetch-today.ts
// Cron: 0 7 * * * npx tsx scripts/fetch-today.ts
//
// ESPN endpoint:
//   ATP: https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard
//   WTA: https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard

import fs from 'fs'
import path from 'path'
import { createTodayResolver } from './espn/identity.ts'
import { competitorId } from './espn/parse.ts'
import { writeHealth } from './espn/health.ts'

const DATA_DIR    = path.join(process.cwd(), 'data')
const TODAY_PATH  = path.join(DATA_DIR, 'today.json')
const MANUAL_PATH = path.join(DATA_DIR, 'today-manual.json')
const RATINGS_PATH = path.join(DATA_DIR, 'ratings.json')

export interface TodayMatch {
  match_id:        string
  tournament:      string
  surface:         string
  round:           string
  best_of:         number
  match_date:      string
  scheduled_time?: string
  player1_id:      string
  player1_name:    string
  player2_id:      string
  player2_name:    string
  source:          string
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

/**
 * Uses global fetch rather than https.get.
 *
 * ESPN 403s this endpoint for the old `https.get` path regardless of the
 * User-Agent sent — a spoofed browser string, a custom one, and none at all
 * all fail, while the same URL through fetch() returns 200. That 403 is the
 * second reason today.json froze at 2026-03-26: the Vercel cron never ran on
 * Netlify, and the script it would have run was failing on its own.
 * scripts/espn/backfill.ts already fetches this host successfully.
 */
async function get(url: string, timeoutMs = 12000): Promise<string> {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.text()
}

// ── Player ID resolution ──────────────────────────────────────────────────────

/**
 * Player ids come from the shared resolver, which matches on the full name
 * (exact, then reordered, then token-subset) and requires a single candidate.
 *
 * The version this replaced fell back to a bare surname and then to a slug.
 * The surname fallback resolved "Zverev" to whichever Zverev was indexed first
 * — a silently wrong player. The slug produced ids like `polona_hercog` that
 * look real, join to nothing, and reported no error; four of them were sitting
 * in today.json with no rating attached.
 */
function loadRatings(): any[] {
  if (!fs.existsSync(RATINGS_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8'))
  } catch {
    return []
  }
}

// ── Surface inference from tournament name ────────────────────────────────────

function inferSurface(tournament: string): string {
  const t = tournament.toLowerCase()
  const clay = ['roland garros','french open','monte-carlo','monte carlo',
    'madrid','rome','barcelona','hamburg','munich','estoril','geneva',
    'bucharest','istanbul','marrakech','belgrade','bogota','buenos aires','houston']
  const grass = ['wimbledon','halle','queens',"queen's",'eastbourne',
    's-hertogenbosch','bad homburg','nottingham','newport','birmingham']
  if (clay.some(k => t.includes(k))) return 'Clay'
  if (grass.some(k => t.includes(k))) return 'Grass'
  return 'Hard'
}

// ── Round normalisation ───────────────────────────────────────────────────────
// ESPN round.displayName values

const ROUND_MAP: Record<string, string> = {
  'final':             'F',
  'semifinal':         'SF',
  'quarterfinal':      'QF',
  'round of 16':       'R16',
  'round of 32':       'R32',
  'round of 64':       'R64',
  'round of 128':      'R128',
  'first round':       'R64',
  'second round':      'R32',
  'third round':       'R16',
  'fourth round':      'R16',
  '1st round':         'R64',
  '2nd round':         'R32',
  '3rd round':         'R16',
  '4th round':         'R16',
  'qualifying 1st round': 'Q1',
  'qualifying 2nd round': 'Q2',
}

function normaliseRound(displayName: string): string {
  return ROUND_MAP[displayName.toLowerCase()] ?? displayName.toUpperCase().replace(/\s+/g, '')
}

function bestOf(round: string, isMasters: boolean, isWTA: boolean): 3 | 5 {
  if (isWTA) return 3
  if ((round === 'F' || round === 'SF') && isMasters) return 5
  return 3
}

// ── ESPN scraper ──────────────────────────────────────────────────────────────

async function fetchESPN(
  tour: 'atp' | 'wta',
  resolver: ReturnType<typeof createTodayResolver>,
): Promise<TodayMatch[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard`
  console.log(`  Fetching ESPN ${tour.toUpperCase()}...`)

  let data: any
  try {
    data = JSON.parse(await get(url))
  } catch (e: any) {
    console.warn(`  ESPN ${tour.toUpperCase()} failed: ${e.message}`)
    return []
  }

  const today = new Date().toISOString().slice(0, 10)
  const isWTA = tour === 'wta'
  const matches: TodayMatch[] = []

  for (const event of (data.events ?? [])) {
    const tournament  = event.name ?? 'Unknown'
    const surface     = inferSurface(tournament)
    const isMasters   = /masters|1000/i.test(tournament)

    for (const grouping of (event.groupings ?? [])) {
      // Tour comes from the grouping, not the endpoint. ESPN's ATP scoreboard
      // returns women's events too, so keying off the URL tagged Coco Gauff and
      // Iga Swiatek as ATP and left them unresolvable against the roster.
      const slug: string = grouping.grouping?.slug ?? ''
      if (slug && !slug.endsWith('-singles')) continue
      const TOUR: 'ATP' | 'WTA' = slug
        ? (slug === 'mens-singles' ? 'ATP' : 'WTA')
        : (isWTA ? 'WTA' : 'ATP')

      for (const comp of (grouping.competitions ?? [])) {
        const status = comp.status?.type?.name

        // Only scheduled or in-progress
        if (status !== 'STATUS_SCHEDULED' && status !== 'STATUS_IN_PROGRESS') continue

        // Only singles (skip doubles)
        const typeText = (comp.type?.text ?? '').toLowerCase()
        if (typeText.includes('double')) continue

        // Need two named players (skip TBD matchups)
        const comps = comp.competitors ?? []
        const p1data = comps[0]
        const p2data = comps[1]
        const p1name = p1data?.displayName ?? p1data?.athlete?.displayName ?? ''
        const p2name = p2data?.displayName ?? p2data?.athlete?.displayName ?? ''
        if (!p1name || !p2name || p1name === 'TBD' || p2name === 'TBD') continue

        // Parse round
        const roundDisplay = comp.round?.displayName ?? 'R32'
        const round        = normaliseRound(roundDisplay)
        const bo           = bestOf(round, isMasters, isWTA)

        // Parse scheduled time (comp.date is ISO string)
        const matchDate    = comp.date ? comp.date.slice(0, 10) : today
        const scheduledTime = comp.date
          ? new Date(comp.date).toISOString().slice(11, 16)
          : undefined

        const p1Id = resolver.resolve(p1name, TOUR, competitorId(p1data))
        const p2Id = resolver.resolve(p2name, TOUR, competitorId(p2data))
        const matchId = `espn_${comp.id}`

        matches.push({
          match_id:       matchId,
          tournament,
          surface,
          round,
          best_of:        bo,
          match_date:     matchDate,
          scheduled_time: scheduledTime,
          player1_id:     p1Id,
          player1_name:   p1name,
          player2_id:     p2Id,
          player2_name:   p2name,
          source:         `espn-${tour}`,
        })
      }
    }
  }

  // Filter to today + next 2 days (include near-future scheduled)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 2)
  const filtered = matches.filter(m => new Date(m.match_date) <= cutoff)

  console.log(`  ESPN ${tour.toUpperCase()}: ${filtered.length} matches`)
  return filtered
}

// ── Manual override ───────────────────────────────────────────────────────────

function loadManual(): TodayMatch[] | null {
  if (!fs.existsSync(MANUAL_PATH)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8'))
    if (Array.isArray(raw) && raw.length > 0) {
      console.log(`  Manual override: ${raw.length} matches`)
      return raw.map((m: any) => ({ ...m, source: 'manual' }))
    }
  } catch {}
  return null
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function dedup(matches: TodayMatch[]): TodayMatch[] {
  const seen = new Set<string>()
  return matches.filter(m => {
    const key = [m.player1_name, m.player2_name].map(n => n.toLowerCase()).sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`\nRallyIQ · fetch-today.ts (${today})\n`)

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  // 1. Manual override wins
  const manual = loadManual()
  if (manual?.length) {
    fs.writeFileSync(TODAY_PATH, JSON.stringify(manual, null, 2))
    console.log(`\n✓ ${manual.length} matches from manual override → data/today.json`)
    return
  }

  const resolver = createTodayResolver(loadRatings())
  let all: TodayMatch[] = []

  // 2. ESPN ATP
  try { all.push(...await fetchESPN('atp', resolver)) }
  catch (e: any) { console.warn('ESPN ATP error:', e.message) }

  // 3. ESPN WTA
  try { all.push(...await fetchESPN('wta', resolver)) }
  catch (e: any) { console.warn('ESPN WTA error:', e.message) }

  const matches = dedup(all).sort((a, b) =>
    (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99')
  )

  if (matches.length === 0) {
    console.warn('\n⚠ No matches found.')
    console.warn('  ESPN may not have today\'s schedule posted yet.')
    console.warn('  Try again later, or create data/today-manual.json')
    console.warn('  (see data/today-manual.json.example for format)')
    return
  }

  fs.writeFileSync(TODAY_PATH, JSON.stringify(matches, null, 2))

  // Names the roster could not resolve. Recorded rather than slugged, so an
  // unrated player in today.json is visible instead of silent.
  const unresolved = resolver.unresolved
  fs.writeFileSync(
    path.join(path.dirname(TODAY_PATH), 'unmatched-today.json'),
    JSON.stringify({ players: unresolved }, null, 1) + '\n',
  )
  if (unresolved.length) {
    console.log(`  ${unresolved.length} unresolved player name(s): ${unresolved.join(', ')}`)
  }

  writeHealth(path.join(DATA_DIR, 'health.json'), 'rallyiq', {
    slate: { records: matches.length, maxAgeHours: 36 },
  })

  const bySrc: Record<string, number> = {}
  matches.forEach(m => { bySrc[m.source] = (bySrc[m.source] ?? 0) + 1 })
  const srcStr = Object.entries(bySrc).map(([s, n]) => `${n} via ${s}`).join(', ')
  console.log(`\n✓ ${matches.length} matches (${srcStr}) → data/today.json`)

  // Warn on players carrying an espn_ id — they are joinable but unrated, so
  // the model falls back to default Elo for them.
  const unrated = matches.filter(m =>
    m.player1_id.startsWith('espn_') || m.player2_id.startsWith('espn_')
  )
  if (unrated.length > 0) {
    console.log(`\n⚠ ${unrated.length} matches have players not in ratings.json`)
    console.log('  Run: npm run ratings:build to pick up newly logged matches')
    console.log('  Model will still run — just using default Elo values for unknown players')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
