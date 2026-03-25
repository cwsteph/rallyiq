// src/lib/data/csvLoader.ts
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import type { ParsedMatch, Surface } from '@/types'

const DATA_DIR = path.join(process.cwd(), 'data')

export function loadCSV(filePath: string): Record<string, string>[] {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath)
  if (!fs.existsSync(fullPath)) {
    console.warn(`CSV not found: ${fullPath}`)
    return []
  }
  const content = fs.readFileSync(fullPath, 'utf-8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
}

export function loadAllMatchCSVs(tour: 'atp' | 'wta'): Record<string, string>[][] {
  if (!fs.existsSync(DATA_DIR)) return []
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(`${tour}_matches_`) && f.endsWith('.csv'))
    .sort()
  return files.map(f => loadCSV(f))
}

export function loadRankingsCSV(tour: 'atp' | 'wta'): Record<string, string>[] {
  const files = fs.existsSync(DATA_DIR)
    ? fs.readdirSync(DATA_DIR).filter(f => f.startsWith(`${tour}_rankings_`) && f.endsWith('.csv')).sort()
    : []
  return files.flatMap(f => loadCSV(f))
}

// Normalize surface strings from Sackmann format
function normalizeSurface(raw: string): Surface {
  const s = (raw || '').toLowerCase().trim()
  if (s.includes('clay')) return 'Clay'
  if (s.includes('grass')) return 'Grass'
  if (s.includes('carpet')) return 'Carpet'
  return 'Hard'
}

function safeInt(val: string | undefined): number {
  const n = parseInt(val || '0', 10)
  return isNaN(n) ? 0 : n
}

// Parse a single row from Sackmann match CSV into a ParsedMatch
export function parseMatchRow(row: Record<string, string>): ParsedMatch | null {
  try {
    // Sackmann columns: tourney_id, tourney_name, surface, draw_size, tourney_level,
    // tourney_date, match_num, winner_id, winner_name, loser_id, loser_name,
    // score, best_of, round, ...stats
    const dateStr = row.tourney_date || ''
    if (!dateStr || dateStr.length < 8) return null

    const matchDate = new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(4, 6)) - 1,
      parseInt(dateStr.slice(6, 8))
    )

    if (isNaN(matchDate.getTime())) return null

    const surface = normalizeSurface(row.surface)
    const bestOf = safeInt(row.best_of) || 3

    const externalId = `${row.tourney_id}_${row.match_num}`

    return {
      externalId,
      tournament: row.tourney_name || 'Unknown',
      surface,
      round: row.round || 'R32',
      bestOf,
      matchDate,
      player1Name: row.winner_name || '',
      player2Name: row.loser_name || '',
      player1Id: row.winner_id || '',
      player2Id: row.loser_id || '',
      winnerId: row.winner_id || '',
      score: row.score || '',
      // Winner serve stats
      p1Aces: safeInt(row.w_ace),
      p1Dfs: safeInt(row.w_df),
      p1SvptWon: safeInt(row.w_svpt),
      p1BpFaced: safeInt(row.w_bpFaced),
      p1BpSaved: safeInt(row.w_bpSaved),
      // Loser serve stats
      p2Aces: safeInt(row.l_ace),
      p2Dfs: safeInt(row.l_df),
      p2SvptWon: safeInt(row.l_svpt),
      p2BpFaced: safeInt(row.l_bpFaced),
      p2BpSaved: safeInt(row.l_bpSaved),
    }
  } catch {
    return null
  }
}

export function parseMatchCSV(filePath: string): ParsedMatch[] {
  const rows = loadCSV(filePath)
  return rows.map(parseMatchRow).filter(Boolean) as ParsedMatch[]
}

export function parseRankingsRow(row: Record<string, string>) {
  return {
    rankDate: new Date(
      parseInt((row.ranking_date || '').slice(0, 4)),
      parseInt((row.ranking_date || '').slice(4, 6)) - 1,
      parseInt((row.ranking_date || '').slice(6, 8))
    ),
    rank: safeInt(row.rank),
    playerId: row.player || '',
    points: safeInt(row.points),
  }
}
