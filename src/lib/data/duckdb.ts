import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { MockOddsProvider } from './oddsProvider'

const prisma = new PrismaClient()
const mock = new MockOddsProvider()

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

function buildRatingsMap(ratings: DBRating[]): Map<string, DBRating> {
  const map = new Map<string, DBRating>()
  for (const r of ratings) {
    map.set(r.player_id, r)
    const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!map.has(slug)) map.set(slug, r)
    const parts = r.name.trim().split(/\s+/)
    const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '')
    if (lastName.length > 3 && !map.has(lastName)) map.set(lastName, r)
  }
  return map
}

function lookupRating(map: Map<string, DBRating>, playerId: string, playerName: string): DBRating | undefined {
  if (map.has(playerId)) return map.get(playerId)
  const slug = playerName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  if (map.has(slug)) return map.get(slug)
  const parts = playerName.trim().split(/\s+/)
  const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '')
  if (map.has(lastName)) return map.get(lastName)
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

  const rows = await prisma.todayMatch.findMany({
    orderBy: { scheduled_time: 'asc' }
  })

  return rows.map(m => {
    const r1 = lookupRating(map, m.player1_id, m.player1_name)
    const r2 = lookupRating(map, m.player2_id, m.player2_name)

    // Use stored odds if available, generate mock as fallback
    // For mock fallback, base on Elo probabilities if we have ratings
    let odds1 = m.odds1
    let odds2 = m.odds2
    if (!odds1 || !odds2) {
      const eloProb = r1 && r2
        ? 1 / (1 + Math.pow(10, (r2.elo_overall - r1.elo_overall) / 400))
        : 0.5
      const generated = mock.generateOdds(eloProb)
      odds1 = generated.odds1
      odds2 = generated.odds2
    }

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
      odds_source:   m.odds_source ?? 'mock',
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