// scripts/build-ratings.ts
// Reads Sackmann CSVs via DuckDB, builds Elo ratings, writes ratings.json + today.json
// Run: npx tsx scripts/build-ratings.ts

import { DuckDBInstance } from '@duckdb/node-api'
import fs from 'fs'
import path from 'path'

const DATA_DIR     = path.join(process.cwd(), 'data')
const RATINGS_PATH = path.join(DATA_DIR, 'ratings.json')
const TODAY_PATH   = path.join(DATA_DIR, 'today.json')
const BASE_ELO     = 1500
const K            = 32
const K_SURFACE    = 24

// ── DuckDB helpers ────────────────────────────────────────────────────────────

async function queryAll<T>(conn: any, sql: string): Promise<T[]> {
  const result = await conn.runAndReadAll(sql)
  return result.getRowObjects() as T[]
}

// ── Elo math ──────────────────────────────────────────────────────────────────

function eloExpected(a: number, b: number) { return 1 / (1 + Math.pow(10, (b - a) / 400)) }

function updateElo(w: number, l: number, k: number) {
  const exp = eloExpected(w, l)
  return {
    winner: Math.round((w + k * (1 - exp)) * 10) / 10,
    loser:  Math.round((l + k * (0 - (1 - exp))) * 10) / 10,
  }
}

// ── Player state ──────────────────────────────────────────────────────────────

interface P {
  playerId: string; name: string; tour: string
  eloOverall: number; eloHard: number; eloClay: number; eloGrass: number
  played: number
  holdSum: number; holdN: number
  form: number[]
  rank: number | null
}

function newP(id: string, name: string, tour: string): P {
  return { playerId: id, name, tour,
    eloOverall: BASE_ELO, eloHard: BASE_ELO, eloClay: BASE_ELO, eloGrass: BASE_ELO,
    played: 0, holdSum: 0, holdN: 0, form: [], rank: null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('RallyIQ · build-ratings.ts\n')
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  const atpFiles = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('atp_matches_') && f.endsWith('.csv'))
    .map(f => `'${path.join(DATA_DIR, f).replace(/\\/g, '/')}'`)
  const wtaFiles = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('wta_matches_') && f.endsWith('.csv'))
    .map(f => `'${path.join(DATA_DIR, f).replace(/\\/g, '/')}'`)

  if (atpFiles.length + wtaFiles.length === 0) {
    console.log('No CSV files found — writing demo ratings\n')
    writeDemoRatings(); writeDemoToday()
    console.log('✓ data/ratings.json  ✓ data/today.json')
    return
  }

  const inst = await DuckDBInstance.create(':memory:')
  const conn = await inst.connect()

  const allFiles = [...atpFiles, ...wtaFiles].join(',')
  console.log(`Loading ${atpFiles.length + wtaFiles.length} CSV files...`)
  await conn.run(`
    CREATE TABLE matches AS
    SELECT * FROM read_csv_auto([${allFiles}], ignore_errors=true)
    ORDER BY tourney_date ASC, match_num ASC
  `)

  const rows = await queryAll<any>(conn, `
    SELECT tourney_id, tourney_name, surface, tourney_date, match_num,
      winner_id, winner_name, loser_id, loser_name,
      CAST(COALESCE(w_bpFaced, 0) AS INTEGER) AS w_bp_faced,
      CAST(COALESCE(w_bpSaved, 0) AS INTEGER) AS w_bp_saved
    FROM matches ORDER BY tourney_date ASC, match_num ASC
  `)

  console.log(`Processing ${rows.length.toLocaleString()} matches...`)
  const players = new Map<string, P>()

  for (const row of rows) {
    const wId = String(row.winner_id), lId = String(row.loser_id)
    const surf = normSurf(row.surface)
    const tour = String(row.tourney_id || '').startsWith('w') ? 'WTA' : 'ATP'

    if (!players.has(wId)) players.set(wId, newP(wId, row.winner_name, tour))
    if (!players.has(lId)) players.set(lId, newP(lId, row.loser_name, tour))
    const w = players.get(wId)!, l = players.get(lId)!

    const kAvg = ((w.played < 30 ? K + 8 : K) + (l.played < 30 ? K + 8 : K)) / 2
    const ov = updateElo(w.eloOverall, l.eloOverall, kAvg)
    w.eloOverall = ov.winner; l.eloOverall = ov.loser

    const sk = surf === 'Hard' ? 'eloHard' : surf === 'Clay' ? 'eloClay' : 'eloGrass' as any
    const sv = updateElo(w[sk], l[sk], K_SURFACE)
    w[sk] = sv.winner; l[sk] = sv.loser

    w.form = [1, ...w.form].slice(0, 20)
    l.form = [0, ...l.form].slice(0, 20)

    if (row.w_bp_faced > 0) {
      const sg = Math.max(1, Math.round(row.w_bp_faced / 3))
      w.holdSum += Math.max(0, 1 - (row.w_bp_faced - row.w_bp_saved) / sg)
      w.holdN++
    }
    w.played++; l.played++
  }

  const ratings = Array.from(players.values()).map(p => ({
    player_id: p.playerId, name: p.name, tour: p.tour,
    elo_overall: Math.round(p.eloOverall * 10) / 10,
    elo_hard:    Math.round(p.eloHard * 10) / 10,
    elo_clay:    Math.round(p.eloClay * 10) / 10,
    elo_grass:   Math.round(p.eloGrass * 10) / 10,
    hold_pct:    p.holdN > 0 ? Math.round(p.holdSum / p.holdN * 1000) / 1000 : 0.75,
    break_pct:   0.25,
    form_score:  p.form.length > 0
      ? Math.round(p.form.slice(0,10).reduce((a:number,b:number)=>a+b,0) / Math.min(10,p.form.length) * 1000) / 1000
      : 0.5,
    form_json:    JSON.stringify(p.form.slice(0, 10)),
    current_rank: p.rank,
    matches_played: p.played,
  }))

  fs.writeFileSync(RATINGS_PATH, JSON.stringify(ratings, null, 2))
  console.log(`✓ ${ratings.length} players → data/ratings.json`)

  // Build today.json from most recent tournament
  const recent = await queryAll<any>(conn, `
    SELECT DISTINCT tourney_id, tourney_name, tourney_date
    FROM matches ORDER BY tourney_date DESC LIMIT 1
  `)
  if (recent[0]) {
    const tid = recent[0].tourney_id
    const todayMatches = await queryAll<any>(conn, `
      SELECT tourney_id || '_' || match_num AS match_id,
        tourney_name AS tournament, surface, round,
        CAST(best_of AS INTEGER) AS best_of, tourney_date AS match_date,
        winner_id AS player1_id, winner_name AS player1_name,
        loser_id AS player2_id, loser_name AS player2_name
      FROM matches WHERE tourney_id = '${tid}' LIMIT 20
    `)
    fs.writeFileSync(TODAY_PATH, JSON.stringify(todayMatches, null, 2))
    console.log(`✓ ${todayMatches.length} matches from ${recent[0].tourney_name} → data/today.json`)
  }

  await conn.close()
  console.log('\n✅ Done. Run: npm run dev')
}

function normSurf(raw: string): 'Hard' | 'Clay' | 'Grass' {
  const s = (raw || '').toLowerCase()
  if (s.includes('clay')) return 'Clay'
  if (s.includes('grass')) return 'Grass'
  return 'Hard'
}

function writeDemoRatings() {
  const players = [
    {player_id:'djokovic', name:'N. Djokovic', tour:'ATP',elo_overall:2180,elo_hard:2200,elo_clay:2190,elo_grass:2160,hold_pct:0.88,break_pct:0.32,form_score:0.9,form_json:'[1,1,1,1,1,1,1,0,1,1]',current_rank:1,matches_played:1200},
    {player_id:'alcaraz',  name:'C. Alcaraz',  tour:'ATP',elo_overall:2140,elo_hard:2100,elo_clay:2210,elo_grass:2090,hold_pct:0.85,break_pct:0.35,form_score:0.8,form_json:'[1,1,0,1,1,1,0,1,1,1]',current_rank:2,matches_played:420},
    {player_id:'sinner',   name:'J. Sinner',   tour:'ATP',elo_overall:2130,elo_hard:2180,elo_clay:2080,elo_grass:2050,hold_pct:0.87,break_pct:0.28,form_score:0.8,form_json:'[1,1,1,0,1,1,1,1,0,1]',current_rank:3,matches_played:380},
    {player_id:'swiatek',  name:'I. Swiatek',  tour:'WTA',elo_overall:2200,elo_hard:2150,elo_clay:2280,elo_grass:2080,hold_pct:0.86,break_pct:0.38,form_score:0.9,form_json:'[1,1,1,1,0,1,1,1,1,1]',current_rank:1,matches_played:580},
    {player_id:'sabalenka',name:'A. Sabalenka',tour:'WTA',elo_overall:2160,elo_hard:2190,elo_clay:2100,elo_grass:2090,hold_pct:0.84,break_pct:0.34,form_score:0.8,form_json:'[1,1,0,1,1,1,0,1,1,1]',current_rank:2,matches_played:510},
  ]
  fs.writeFileSync(RATINGS_PATH, JSON.stringify(players, null, 2))
}

function writeDemoToday() {
  const today = new Date().toISOString().slice(0,10)
  const matches = [
    {match_id:'demo_001',tournament:'Miami Open',surface:'Hard',round:'QF',best_of:3,match_date:today,scheduled_time:'17:00',player1_id:'sinner',player1_name:'J. Sinner',player2_id:'alcaraz',player2_name:'C. Alcaraz',source:'demo'},
    {match_id:'demo_002',tournament:'Miami Open',surface:'Hard',round:'QF',best_of:3,match_date:today,scheduled_time:'19:00',player1_id:'swiatek',player1_name:'I. Swiatek',player2_id:'sabalenka',player2_name:'A. Sabalenka',source:'demo'},
  ]
  fs.writeFileSync(TODAY_PATH, JSON.stringify(matches, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
