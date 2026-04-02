/**
 * build-ratings.mjs
 * Rebuilds data/ratings.json from Sackmann CSV sources + TML 2025/2026.
 *
 * Run from your rallyiq repo root:
 *   node scripts/build-ratings.mjs
 *
 * Requirements: Node 18+ (uses built-in fetch). No npm installs needed.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '../data/ratings.json')

// ─── Sources ──────────────────────────────────────────────────────────────────
// Sackmann ATP: 2022-2024 (your existing base)
// TML-Database ATP: 2025, 2026 (live-updated fork of Sackmann)
// Sackmann WTA: 2022-2024
// Sackmann WTA 2025: checked at runtime, used if available

const ATP_SOURCES = [
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_2022.csv', tour: 'ATP', year: 2022 },
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_2023.csv', tour: 'ATP', year: 2023 },
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_2024.csv', tour: 'ATP', year: 2024 },
  // TML-Database for 2025/2026 (same CSV format as Sackmann, ATP only)
  { url: 'https://raw.githubusercontent.com/Tennismylife/TML-Database/master/2025.csv', tour: 'ATP', year: 2025, tml: true },
  { url: 'https://raw.githubusercontent.com/Tennismylife/TML-Database/master/2026.csv', tour: 'ATP', year: 2026, tml: true },
]

const WTA_SOURCES = [
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_2022.csv', tour: 'WTA', year: 2022 },
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_2023.csv', tour: 'WTA', year: 2023 },
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_2024.csv', tour: 'WTA', year: 2024 },
  // 2025 WTA — Sackmann may or may not have this yet; script handles 404 gracefully
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_2025.csv', tour: 'WTA', year: 2025 },
  { url: 'https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_2026.csv', tour: 'WTA', year: 2026 },
]

// ─── Elo config ───────────────────────────────────────────────────────────────
const ELO_START = 1500
const K_BASE = 32
// Surface keys in CSV -> our keys
const SURFACE_MAP = { Hard: 'elo_hard', Clay: 'elo_clay', Grass: 'elo_grass', Carpet: 'elo_hard' }

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
  }).filter(r => r.winner_name && r.loser_name)
}

// ─── Fetch with graceful 404 ──────────────────────────────────────────────────
async function fetchCSV(src) {
  try {
    const res = await fetch(src.url, { headers: { 'User-Agent': 'RallyIQ-ratings-builder/1.0' } })
    if (!res.ok) {
      console.log(`  ⚠️  ${src.year} ${src.tour} — ${res.status} (skipping)`)
      return []
    }
    const text = await res.text()
    if (!text || text.trim().startsWith('404')) {
      console.log(`  ⚠️  ${src.year} ${src.tour} — empty/404 (skipping)`)
      return []
    }
    const rows = parseCSV(text)
    console.log(`  ✅ ${src.year} ${src.tour} — ${rows.length} matches`)
    return rows.map(r => ({ ...r, _tour: src.tour, _tml: src.tml ?? false }))
  } catch (e) {
    console.log(`  ❌ ${src.year} ${src.tour} — ${e.message} (skipping)`)
    return []
  }
}

// ─── Slugify for player_id fallback ──────────────────────────────────────────
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

// ─── Expected Elo score ───────────────────────────────────────────────────────
function expected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)) }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎾 RallyIQ ratings builder\n')

  // Fetch all sources in parallel
  console.log('Fetching ATP sources...')
  const atpRows = (await Promise.all(ATP_SOURCES.map(fetchCSV))).flat()
  console.log('Fetching WTA sources...')
  const wtaRows = (await Promise.all(WTA_SOURCES.map(fetchCSV))).flat()

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
        hold_pct: 0.75,
        break_pct: 0.25,
        form: [],         // last 10: 1=win 0=loss
        matches_played: 0,
        current_rank: null,
        _svptW: 0, _1stWonW: 0, _2ndWonW: 0, _bpFacedW: 0, _bpSavedW: 0,
        _svptL: 0, _1stWonL: 0, _2ndWonL: 0, _bpFacedL: 0, _bpSavedL: 0,
      })
    }
    return players.get(key)
  }

  function updateElo(winner, loser, surface) {
    const surfKey = SURFACE_MAP[surface] ?? null

    // Overall Elo
    const expW = expected(winner.elo_overall, loser.elo_overall)
    const expL = expected(loser.elo_overall, winner.elo_overall)
    winner.elo_overall += K_BASE * (1 - expW)
    loser.elo_overall  += K_BASE * (0 - expL)

    // Surface Elo
    if (surfKey) {
      const expWs = expected(winner[surfKey], loser[surfKey])
      const expLs = expected(loser[surfKey], winner[surfKey])
      winner[surfKey] += K_BASE * (1 - expWs)
      loser[surfKey]  += K_BASE * (0 - expLs)
    }
  }

  function accumulateStats(player, row, isWinner) {
    const prefix = isWinner ? 'w_' : 'l_'
    const svpt   = parseInt(row[`${prefix}svpt`])   || 0
    const first  = parseInt(row[`${prefix}1stWon`]) || 0
    const second = parseInt(row[`${prefix}2ndWon`]) || 0
    const bpF    = parseInt(row[`${prefix}bpFaced`])|| 0
    const bpS    = parseInt(row[`${prefix}bpSaved`])|| 0
    if (isWinner) {
      player._svptW   += svpt;  player._1stWonW += first
      player._2ndWonW += second; player._bpFacedW += bpF; player._bpSavedW += bpS
    } else {
      player._svptL   += svpt;  player._1stWonL += first
      player._2ndWonL += second; player._bpFacedL += bpF; player._bpSavedL += bpS
    }
  }

  // ── Process matches ───────────────────────────────────────────────────────
  let processed = 0
  for (const row of allRows) {
    const tour = row._tour
    // TML uses different column names — map them
    const winName  = row.winner_name  ?? row.Winner ?? ''
    const losName  = row.loser_name   ?? row.Loser  ?? ''
    const winId    = row.winner_id    ?? row.winner_player_id ?? ''
    const losId    = row.loser_id     ?? row.loser_player_id  ?? ''
    const surface  = row.surface      ?? row.Surface ?? 'Hard'
    const winRank  = row.winner_rank  ?? row.WRank   ?? null
    const losRank  = row.loser_rank   ?? row.LRank   ?? null

    if (!winName || !losName) continue

    const winner = getPlayer(winName, winId, tour)
    const loser  = getPlayer(losName, losId, tour)

    updateElo(winner, loser, surface)
    accumulateStats(winner, row, true)
    accumulateStats(loser,  row, false)

    winner.form = [...winner.form.slice(-9), 1]
    loser.form  = [...loser.form.slice(-9),  0]
    winner.matches_played++
    loser.matches_played++

    if (winRank) winner.current_rank = parseInt(winRank) || null
    if (losRank) loser.current_rank  = parseInt(losRank) || null

    processed++
  }

  console.log(`\nProcessed ${processed} matches across ${players.size} players`)

  // ── Compute final stats ───────────────────────────────────────────────────
  const ratings = []
  for (const [, p] of players) {
    if (p.matches_played < 3) continue  // skip players with too few matches

    // hold% = serve points won / total serve points (winner perspective)
    const totalSvpt = p._svptW + p._svptL
    const totalWon  = p._1stWonW + p._2ndWonW + p._1stWonL + p._2ndWonL
    const hold_pct  = totalSvpt > 0 ? Math.round((totalWon / totalSvpt) * 1000) / 1000 : 0.65

    // break% = opponent bp converted = bp faced by loser not saved
    const bpFaced  = p._bpFacedW + p._bpFacedL
    const bpSaved  = p._bpSavedW + p._bpSavedL
    const break_pct = bpFaced > 0 ? Math.round(((bpFaced - bpSaved) / bpFaced) * 1000) / 1000 : 0.35

    const form10 = p.form.slice(-10)
    const form_score = form10.length > 0 ? Math.round((form10.reduce((a, b) => a + b, 0) / form10.length) * 100) / 100 : 0.5

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
      current_rank:  p.current_rank,
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
}

main().catch(e => { console.error(e); process.exit(1) })
