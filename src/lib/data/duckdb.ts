import fs from 'fs'
import path from 'path'
import { MockOddsProvider } from './oddsProvider'

const mock = new MockOddsProvider()

const RATINGS_PATH = path.join(process.cwd(), 'data', 'ratings.json')
const TODAY_PATH = path.join(process.cwd(), 'data', 'today.json')

export interface DBRating {
  player_id: string; name: string; tour: string;
  elo_overall: number; elo_hard: number; elo_clay: number; elo_grass: number;
  hold_pct: number; break_pct: number; form_score: number; form_json: string;
  current_rank: number | null; matches_played: number
}

export interface DBMatch {
  match_id: string; tournament: string; surface: string; round: string;
  best_of: number; match_date: string; scheduled_time?: string;
  tour: 'ATP' | 'WTA';
  player1_id: string; player1_name: string; player2_id: string; player2_name: string; source: string
}

function readRatings(): DBRating[] {
  if (!fs.existsSync(RATINGS_PATH)) return []
  try { return JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8')) } catch { return [] }
}

/**
 * The slate is data/today.json, written by the daily refresh and committed.
 *
 * It used to come from the Neon TodayMatch table, whose only writer was
 * POST /api/refresh — a fork of scripts/fetch-today.ts that still used
 * https.get (which ESPN 403s) and still slugified player ids. Nothing in src/
 * read today.json at all, so the file the workflow published and the rows the
 * site served had been diverging since June.
 */
function readToday(): DBMatch[] {
  if (!fs.existsSync(TODAY_PATH)) return []
  try { return JSON.parse(fs.readFileSync(TODAY_PATH, 'utf8')) } catch { return [] }
}

const slugOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const lastNameOf = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Keyed on `tour:player_id`. Sackmann's ATP and WTA id spaces overlap — five
 * ids are shared across tours, so 211768 is both Naomi Osaka and Manas Dhamne.
 * A bare player_id key handed back whichever tour happened to be written last.
 *
 * Name-based fallbacks stay unqualified: they exist for players the roster
 * could not resolve by id, where the tour is the only thing we do know.
 */
function buildRatingsMap(ratings: DBRating[]): Map<string, DBRating> {
  const map = new Map<string, DBRating>()
  for (const r of ratings) {
    map.set(`${r.tour}:${r.player_id}`, r)
    if (!map.has(r.player_id)) map.set(r.player_id, r)
    const slug = slugOf(r.name)
    if (!map.has(slug)) map.set(slug, r)
    const lastName = lastNameOf(r.name)
    if (lastName.length > 3 && !map.has(lastName)) map.set(lastName, r)
  }
  return map
}

function lookupRating(
  map: Map<string, DBRating>,
  tour: string | undefined,
  playerId: string,
  playerName: string,
): DBRating | undefined {
  if (tour && map.has(`${tour}:${playerId}`)) return map.get(`${tour}:${playerId}`)
  if (map.has(playerId)) return map.get(playerId)
  const slug = slugOf(playerName)
  if (map.has(slug)) return map.get(slug)
  const lastName = lastNameOf(playerName)
  if (map.has(lastName)) return map.get(lastName)
  return undefined
}

export async function getPlayers(tour?: 'ATP' | 'WTA', limit?: number): Promise<DBRating[]> {
  const all = readRatings()
  const filtered = (tour ? all.filter(p => p.tour === tour) : all)
    .sort((a, b) => b.elo_overall - a.elo_overall)
  return limit && limit > 0 ? filtered.slice(0, limit) : filtered
}

/** Tour-qualified: player_id alone is ambiguous for five players. */
export async function getPlayer(tour: 'ATP' | 'WTA', playerId: string): Promise<DBRating | null> {
  return readRatings().find(p => p.tour === tour && p.player_id === playerId) ?? null
}

export async function getTodayMatches(): Promise<any[]> {
  const ratings = readRatings()
  const map = buildRatingsMap(ratings)

  const rows = readToday()
    .slice()
    .sort((a, b) => (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99'))

  return rows.map(m => {
    const r1 = lookupRating(map, m.tour, m.player1_id, m.player1_name)
    const r2 = lookupRating(map, m.tour, m.player2_id, m.player2_name)

    // Every price is a mock. fetchRealOdds required ODDS_API_KEY, which
    // .env.example never named the same way (THE_ODDS_API_KEY), so real odds
    // have never been live. Basing the mock on the Elo split keeps the edge
    // distribution sane rather than uniformly random.
    const eloProb = r1 && r2
      ? 1 / (1 + Math.pow(10, (r2.elo_overall - r1.elo_overall) / 400))
      : 0.5
    const { odds1, odds2 } = mock.generateOdds(eloProb)

    return {
      match_id:      m.match_id,
      tournament:    m.tournament,
      surface:       m.surface,
      round:         m.round,
      best_of:       m.best_of,
      match_date:    m.match_date,
      scheduled_time: m.scheduled_time ?? undefined,
      tour:          m.tour,
      player1_id:    m.player1_id,
      player1_name:  m.player1_name,
      player2_id:    m.player2_id,
      player2_name:  m.player2_name,
      source:        m.source,
      odds_source:   'mock',
      // Player 1 ratings
      p1_elo_overall: r1?.elo_overall ?? 1500,
      p1_elo_hard:    r1?.elo_hard    ?? 1500,
      p1_elo_clay:    r1?.elo_clay    ?? 1500,
      p1_elo_grass:   r1?.elo_grass   ?? 1500,
      p1_hold_pct:    r1?.hold_pct    ?? 0.65,
      p1_break_pct:   r1?.break_pct   ?? 0.35,
      p1_form_score:  r1?.form_score  ?? 0.5,
      p1_form_json:   r1?.form_json   ?? '[]',
      p1_rank:        r1?.current_rank ?? null,
      p1_matched:     !!r1,
      p1_odds:        odds1,
      // Player 2 ratings
      p2_elo_overall: r2?.elo_overall ?? 1500,
      p2_elo_hard:    r2?.elo_hard    ?? 1500,
      p2_elo_clay:    r2?.elo_clay    ?? 1500,
      p2_elo_grass:   r2?.elo_grass   ?? 1500,
      p2_hold_pct:    r2?.hold_pct    ?? 0.65,
      p2_break_pct:   r2?.break_pct   ?? 0.35,
      p2_form_score:  r2?.form_score  ?? 0.5,
      p2_form_json:   r2?.form_json   ?? '[]',
      p2_rank:        r2?.current_rank ?? null,
      p2_matched:     !!r2,
      p2_odds:        odds2,
    }
  })
}

export async function getTodayMatch(matchId: string): Promise<any | null> {
  return (await getTodayMatches()).find(m => m.match_id === matchId) ?? null
}

export async function getH2H(p1Id?: string, p2Id?: string): Promise<any[]> { return [] }
export async function getBacktestMatches(surface?: string, limit?: number): Promise<any[]> { return [] }
export async function rawQuery<T = any>(sql?: string): Promise<T[]> { return [] }