/**
 * build-ratings.mjs
 * Rebuilds data/ratings.json from Jeff Sackmann's ATP + WTA CSVs (matches + rankings).
 * This is the builder GitHub Actions runs weekly (.github/workflows/rebuild-ratings.yml).
 * It must stay in sync with build-ratings.ts (the local-from-CSV path) — same logic, same output.
 *
 * Run from your rallyiq repo root:
 *   node scripts/build-ratings.mjs
 *
 * Requirements: Node 18+ (uses built-in fetch). No npm installs needed.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { readLog, afterBase, toCsvRows } from './espn/log.ts'
import { buildIdentityMap, resolvePlayerId } from './espn/identity.ts'
import { fetchRankings } from './espn/rankings.ts'
import { writeHealth } from './espn/health.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// --out lets the continuity check build to a scratch file instead of clobbering
// the live ratings.
const outIdx = process.argv.indexOf('--out')
const OUT_PATH = outIdx > -1 && process.argv[outIdx + 1]
  ? path.resolve(process.argv[outIdx + 1])
  : path.join(__dirname, '../data/ratings.json')
const RATINGS_PATH = path.join(__dirname, '../data/ratings.json')

// ─── Sources ──────────────────────────────────────────────────────────────────
// All Sackmann. (TML-Database was dropped 2026-06: its GitHub CSVs froze Jan 2026,
// are ATP-only, and use an incompatible player-id scheme — it was making ATP 2025/26 STALE.)
// The committed Sackmann snapshot: 2022-01-01 → 2026-05-17 (ATP) / 05-18 (WTA).
// The upstream repos were deleted in June 2026, so these files are the archive
// and are read from disk, never fetched.
const DATA_DIR = path.join(__dirname, '../data')
const BASE_ONLY = process.argv.includes('--base-only')

const ATP_SOURCES = [2022, 2023, 2024, 2025, 2026].map(year => ({
  file: path.join(DATA_DIR, `atp_matches_${year}.csv`), tour: 'ATP', year,
}))

const WTA_SOURCES = [2022, 2023, 2024, 2025, 2026].map(year => ({
  file: path.join(DATA_DIR, `wta_matches_${year}.csv`), tour: 'WTA', year,
}))

// Ranking base: the committed CSVs (deep, but frozen at 2026-06-02). ESPN's
// live top 150 per tour is overlaid on top unless --base-only is passed.
const RANKING_SOURCES = [
  { file: path.join(DATA_DIR, 'atp_rankings_current.csv'), tour: 'ATP' },
  { file: path.join(DATA_DIR, 'wta_rankings_current.csv'), tour: 'WTA' },
]

// ─── Elo config ───────────────────────────────────────────────────────────────
// Kept identical to build-ratings.ts: rookie bonus on overall, lower (steadier) K on surface.
const ELO_START = 1500
const K_BASE = 32
const K_SURFACE = 24
const ROOKIE_BONUS = 8   // higher K while a player has < 30 matches
// Surface keys in CSV -> our keys
const SURFACE_MAP = { Hard: 'elo_hard', Clay: 'elo_clay', Grass: 'elo_grass', Carpet: 'elo_hard' }

// Probability of winning a service/return game given per-point win probability p.
// Turns serve/return point-win rates into game-level hold% / break% for the simulator.
function gameWinProb(p) {
  if (p <= 0) return 0
  if (p >= 1) return 1
  const q = 1 - p
  const toLove = Math.pow(p, 4)
  const to15   = 4 * Math.pow(p, 4) * q
  const to30   = 10 * Math.pow(p, 4) * q * q
  const deuce  = 20 * Math.pow(p, 3) * Math.pow(q, 3)
  return toLove + to15 + to30 + deuce * ((p * p) / (p * p + q * q))
}

// ─── CSV parser (handles quoted fields) ───────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (!lines.length) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur); cur = '' }
      else cur += ch
    }
    vals.push(cur)
    const row = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
  // Note: don't filter on winner/loser here — this parser is also used for the
  // rankings CSVs (no winner/loser columns). The match loop drops incomplete rows.
}

// ─── Local CSV load — a missing base file is fatal, never "skipped" ───────────
// The previous version fetched these over HTTP and swallowed 404s with a warning
// and exit 0. That is why six consecutive weekly workflow runs went green while
// processing zero matches after the upstream repos were deleted.
function loadCSV(src) {
  if (!fs.existsSync(src.file)) {
    console.error(`  ❌ MISSING: ${src.file}`)
    process.exit(1)
  }
  const rows = parseCSV(fs.readFileSync(src.file, 'utf8'))
  if (!rows.length) {
    console.error(`  ❌ EMPTY: ${src.file}`)
    process.exit(1)
  }
  console.log(`  ✅ ${src.year ?? 'rankings'} ${src.tour} — ${rows.length} rows`)
  return rows.map(r => ({ ...r, _tour: src.tour }))
}

/**
 * Everything after the CSV cutoff comes from the ESPN log.
 *
 * ESPN ids and Sackmann ids are different id spaces, so the log's espn ids are
 * translated to existing player_ids first. Without that, Sinner enters twice —
 * ATP:206173 from the CSVs and ATP:3623 from ESPN — and his Elo splits in half.
 */
function loadEspnRows(tour, identityMap) {
  if (BASE_ONLY) return []
  const rows = toCsvRows(afterBase(readLog(path.join(DATA_DIR, 'results.ndjson')).filter(m => m.tour === tour)))
  const mapped = rows.map(r => ({
    ...r,
    winner_id: resolvePlayerId(identityMap, r.winner_id),
    loser_id: resolvePlayerId(identityMap, r.loser_id),
    _tour: tour,
  }))
  console.log(`  ✅ ${tour} espn log — ${mapped.length} rows`)
  return mapped
}

// ─── Slugify for player_id fallback ──────────────────────────────────────────
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

// ─── Expected Elo score ───────────────────────────────────────────────────────
function expected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)) }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎾 RallyIQ ratings builder\n')

  // The identity map translates ESPN ids to the player_ids already in
  // ratings.json. Built from the previous ratings file plus every player the
  // log has observed — the only fuzzy name matching in the pipeline.
  let identityMap = {}
  if (!BASE_ONLY && fs.existsSync(RATINGS_PATH)) {
    const prev = JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8'))
    const log = readLog(path.join(DATA_DIR, 'results.ndjson'))
    const observed = []
    for (const m of log) {
      observed.push({ espn_id: m.winner_espn_id, name: m.winner_name, tour: m.tour })
      observed.push({ espn_id: m.loser_espn_id, name: m.loser_name, tour: m.tour })
    }
    const built = buildIdentityMap(prev, [], observed)
    identityMap = built.map
    console.log(`Identity: ${Object.keys(identityMap).length} espn ids mapped, ${built.unmatched.length} unmatched`)
    fs.writeFileSync(
      path.join(DATA_DIR, 'unmatched-players.json'),
      JSON.stringify({ players: built.unmatched }, null, 1) + '\n',
    )
  }

  console.log('Loading ATP sources...')
  const atpRows = [...ATP_SOURCES.map(loadCSV).flat(), ...loadEspnRows('ATP', identityMap)]
  console.log('Loading WTA sources...')
  const wtaRows = [...WTA_SOURCES.map(loadCSV).flat(), ...loadEspnRows('WTA', identityMap)]

  const allRows = [...atpRows, ...wtaRows]
  console.log(`\nTotal matches loaded: ${allRows.length}`)

  // Sort chronologically (tourney_date is YYYYMMDD string)
  allRows.sort((a, b) => (a.tourney_date ?? '0').localeCompare(b.tourney_date ?? '0'))

  // ── Build player state ────────────────────────────────────────────────────
  // Map: playerKey -> state object
  const players = new Map()

  function getPlayer(name, id, tour) {
    const key = id && id !== '' ? `${tour}:${id}` : `${tour}:${slugify(name)}`
    if (!players.has(key)) {
      players.set(key, {
        player_id: id && id !== '' ? id : slugify(name),
        name,
        tour,
        elo_overall: ELO_START,
        elo_hard: ELO_START,
        elo_clay: ELO_START,
        elo_grass: ELO_START,
        form: [],         // last 10: 1=win 0=loss
        matches_played: 0,
        // serve/return point accumulators → game-level hold% / break%
        svPtsWon: 0, svPts: 0, rtPtsWon: 0, rtPts: 0,
      })
    }
    return players.get(key)
  }

  function updateElo(winner, loser, surface) {
    const surfKey = SURFACE_MAP[surface] ?? null

    // Overall Elo — averaged K with a rookie bonus while either player is under 30 matches.
    const kw = winner.matches_played < 30 ? K_BASE + ROOKIE_BONUS : K_BASE
    const kl = loser.matches_played  < 30 ? K_BASE + ROOKIE_BONUS : K_BASE
    const kAvg = (kw + kl) / 2
    const expW = expected(winner.elo_overall, loser.elo_overall)
    winner.elo_overall += kAvg * (1 - expW)
    loser.elo_overall  += kAvg * (0 - (1 - expW))

    // Surface Elo — steadier K.
    if (surfKey) {
      const expWs = expected(winner[surfKey], loser[surfKey])
      winner[surfKey] += K_SURFACE * (1 - expWs)
      loser[surfKey]  += K_SURFACE * (0 - (1 - expWs))
    }
  }

  // Accumulate serve + return points for both players from one match row.
  // A player's return points won = the opponent's serve points lost.
  function accumulatePoints(winner, loser, row) {
    const wSv = parseInt(row.w_svpt) || 0, lSv = parseInt(row.l_svpt) || 0
    const wSvWon = (parseInt(row.w_1stWon) || 0) + (parseInt(row.w_2ndWon) || 0)
    const lSvWon = (parseInt(row.l_1stWon) || 0) + (parseInt(row.l_2ndWon) || 0)
    if (wSv <= 0 || lSv <= 0) return
    winner.svPtsWon += wSvWon; winner.svPts += wSv
    loser.svPtsWon  += lSvWon; loser.svPts  += lSv
    winner.rtPtsWon += (lSv - lSvWon); winner.rtPts += lSv
    loser.rtPtsWon  += (wSv - wSvWon); loser.rtPts  += wSv
  }

  // ── Process matches ───────────────────────────────────────────────────────
  let processed = 0
  for (const row of allRows) {
    const tour = row._tour
    const winName = row.winner_name ?? ''
    const losName = row.loser_name  ?? ''
    const winId   = row.winner_id   ?? ''
    const losId   = row.loser_id    ?? ''
    const surface = row.surface     ?? 'Hard'

    if (!winName || !losName) continue

    const winner = getPlayer(winName, winId, tour)
    const loser  = getPlayer(losName, losId, tour)

    updateElo(winner, loser, surface)
    accumulatePoints(winner, loser, row)

    winner.form = [...winner.form.slice(-9), 1]
    loser.form  = [...loser.form.slice(-9),  0]
    winner.matches_played++
    loser.matches_played++
    processed++
  }

  console.log(`\nProcessed ${processed} matches across ${players.size} players`)

  // ── Official current rankings (latest week) → current_rank + points ─────────
  // Official list only, so retired players don't leak a stale top rank.
  const rankMap = new Map()  // `${tour}:${player_id}` -> { rank, points }
  for (const src of RANKING_SOURCES) {
    const rows = loadCSV(src)
    if (!rows.length) continue
    const latest = rows.reduce((m, r) => (r.ranking_date > m ? r.ranking_date : m), '0')
    let n = 0
    for (const r of rows) {
      if (r.ranking_date !== latest) continue
      rankMap.set(`${src.tour}:${r.player}`, { rank: parseInt(r.rank) || null, points: parseInt(r.points) || null })
      n++
    }
    console.log(`  📊 ${src.tour} rankings — ${n} players (week ${latest})`)
  }

  // Overlay ESPN's live top 150 per tour. The committed ranking CSVs are deeper
  // (~1,180 players) but frozen at 2026-06-02, so the overlay refreshes exactly
  // the range where rank is worth showing. Rank is display-only and never
  // reaches computeWinProbability, so a miss here cannot move a price.
  if (!BASE_ONLY) {
    for (const tour of ['ATP', 'WTA']) {
      const live = await fetchRankings(tour)
      if (!live.length) {
        console.log(`  ⚠️  ${tour} live rankings unavailable — keeping the frozen csv ranks`)
        continue
      }
      let n = 0
      for (const r of live) {
        const player_id = resolvePlayerId(identityMap, r.espn_id)
        rankMap.set(`${tour}:${player_id}`, { rank: r.rank, points: r.points })
        n++
      }
      console.log(`  📊 ${tour} live espn rankings — ${n} players overlaid`)
    }
  }

  // ── Compute final stats ───────────────────────────────────────────────────
  const ratings = []
  for (const [, p] of players) {
    // Game-level hold% / break% from aggregated serve/return point-win rates.
    const hold_pct  = p.svPts >= 50 ? Math.round(gameWinProb(p.svPtsWon / p.svPts) * 1000) / 1000 : 0.75
    const break_pct = p.rtPts >= 50 ? Math.round(gameWinProb(p.rtPtsWon / p.rtPts) * 1000) / 1000 : 0.20

    const form10 = p.form.slice(-10)
    const form_score = form10.length > 0 ? Math.round((form10.reduce((a, b) => a + b, 0) / form10.length) * 100) / 100 : 0.5

    const official = rankMap.get(`${p.tour}:${p.player_id}`)

    ratings.push({
      player_id:     p.player_id,
      name:          p.name,
      tour:          p.tour,
      elo_overall:   Math.round(p.elo_overall * 10) / 10,
      elo_hard:      Math.round(p.elo_hard * 10) / 10,
      elo_clay:      Math.round(p.elo_clay * 10) / 10,
      elo_grass:     Math.round(p.elo_grass * 10) / 10,
      hold_pct,
      break_pct,
      form_score,
      form_json:     JSON.stringify(form10),
      current_rank:        official?.rank ?? null,
      current_rank_points: official?.points ?? null,
      matches_played: p.matches_played,
    })
  }

  // Sort by Elo descending
  ratings.sort((a, b) => b.elo_overall - a.elo_overall)

  const atpCount = ratings.filter(r => r.tour === 'ATP').length
  const wtaCount = ratings.filter(r => r.tour === 'WTA').length
  console.log(`\nFinal ratings: ${ratings.length} players (ATP: ${atpCount}, WTA: ${wtaCount})`)
  console.log(`Top ATP: ${ratings.filter(r=>r.tour==='ATP')[0]?.name} (${ratings.filter(r=>r.tour==='ATP')[0]?.elo_overall})`)
  console.log(`Top WTA: ${ratings.filter(r=>r.tour==='WTA')[0]?.name} (${ratings.filter(r=>r.tour==='WTA')[0]?.elo_overall})`)

  fs.writeFileSync(OUT_PATH, JSON.stringify(ratings, null, 2))
  console.log(`\n✅ Written to ${OUT_PATH}\n`)

  // Only the real build publishes health; --base-only and --out are diagnostics.
  if (!BASE_ONLY && outIdx === -1) {
    writeHealth(path.join(DATA_DIR, 'health.json'), 'rallyiq', {
      ratings: { records: ratings.length, maxAgeHours: 72 },
    })
    console.log(`health: ratings feed at ${ratings.length} records`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
