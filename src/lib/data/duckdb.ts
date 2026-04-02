import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RATINGS_PATH = path.join(process.cwd(), 'data', 'ratings.json')

export interface DBRating {
  player_id: string; name: string; tour: string;
  elo_overall: number; elo_hard: number; elo_clay: number; elo_grass: number;
  hold_pct: number; break_pct: number; form_score: number; form_json: string;
  current_rank: number | null; matches_played: number
}

export interface DBMatch {
  match_id: string; tournament: string; surface: string; round: string;
  best_of: number; match_date: string; scheduled_time?: string;
  player1_id: string; player1_name: string; player2_id: string; player2_name: string; source: string
}

function readRatings(): DBRating[] {
  if (!fs.existsSync(RATINGS_PATH)) return []
  try { return JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8')) } catch { return [] }
}

// Build a lookup map that tries multiple match strategies:
// 1. exact player_id (slugified name)
// 2. slugified display name (ESPN sometimes abbreviates e.g. "I. Swiatek")
// 3. last name only fallback
function buildRatingsMap(ratings: DBRating[]): Map<string, DBRating> {
  const map = new Map<string, DBRating>()
  for (const r of ratings) {
    // Primary: exact player_id
    map.set(r.player_id, r)
    // Secondary: slugified full name (in case player_id differs)
    const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!map.has(slug)) map.set(slug, r)
    // Tertiary: last name only (e.g. "swiatek")
    const parts = r.name.trim().split(/\s+/)
    const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '')
    if (lastName.length > 3 && !map.has(lastName)) map.set(lastName, r)
  }
  return map
}

function lookupRating(map: Map<string, DBRating>, playerId: string, playerName: string): DBRating | undefined {
  // 1. Direct player_id match
  if (map.has(playerId)) return map.get(playerId)
  // 2. Slugified display name
  const slug = playerName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  if (map.has(slug)) return map.get(slug)
  // 3. Last name of display name
  const parts = playerName.trim().split(/\s+/)
  const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '')
  if (map.has(lastName)) return map.get(lastName)
  // 4. First name initial + last name (ESPN sometimes gives "I. Swiatek")
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '')
    if (map.has(last)) return map.get(last)
  }
  return undefined
}

export async function getPlayers(tour?: 'ATP' | 'WTA'): Promise<DBRating[]> {
  const all = readRatings()
  return (tour ? all.filter(p => p.tour === tour) : all)
    .sort((a, b) => b.elo_overall - a.elo_overall)
    .slice(0, 200)
}

export async function getPlayer(id: string): Promise<DBRating | null> {
  return readRatings().find(p => p.player_id === id) ?? null
}

export async function getTodayMatches(): Promise<any[]> {
  const ratings = readRatings()
  const map = buildRatingsMap(ratings)

  // Read from Neon DB
  const rows = await prisma.todayMatch.findMany({
    orderBy: { scheduled_time: 'asc' }
  })

  return rows.map(m => {
    const r1 = lookupRating(map, m.player1_id, m.player1_name)
    const r2 = lookupRating(map, m.player2_id, m.player2_name)
    return {
      match_id:      m.match_id,
      tournament:    m.tournament,
      surface:       m.surface,
      round:         m.round,
      best_of:       m.best_of,
      match_date:    m.match_date,
      scheduled_time: m.scheduled_time ?? undefined,
      player1_id:    m.player1_id,
      player1_name:  m.player1_name,
      player2_id:    m.player2_id,
      player2_name:  m.player2_name,
      source:        m.source,
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
      p1_matched:     !!r1,  // debug flag — true if rating was found
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
      p2_matched:     !!r2,  // debug flag
    }
  })
}

export async function getTodayMatch(matchId: string): Promise<any | null> {
  return (await getTodayMatches()).find(m => m.match_id === matchId) ?? null
}

export async function getH2H(p1Id?: string, p2Id?: string): Promise<any[]> { return [] }
export async function getBacktestMatches(surface?: string, limit?: number): Promise<any[]> { return [] }
export async function rawQuery<T = any>(sql?: string): Promise<T[]> { return [] }