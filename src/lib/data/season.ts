// src/lib/data/season.ts
//
// Reads data/search-index.json, the season artefact the daily workflow builds
// and commits. Cached at module scope, so a warm serverless instance parses it
// once rather than per request.

import fs from 'fs'
import path from 'path'
import { normalizeName } from '@/lib/search/slug'

const INDEX_PATH = path.join(process.cwd(), 'data', 'search-index.json')

export interface IndexTournament {
  slug: string
  name: string
  tours: string[]
  surface: string | null
  start: string
  end: string
  matches: number
}

export interface IndexPlayer {
  id: string // `${tour}-${player_id}`, lowercased tour
  tour: 'ATP' | 'WTA'
  player_id: string
  name: string
  rank: number | null
  elo: number
}

/** Short keys: the file carries ~5,000 of these and is read whole. */
export interface IndexResult {
  s: string // tournament slug
  d: string // YYYY-MM-DD
  r: string // round
  b: number // best of
  w: string // winner ref
  l: string // loser ref
  sc: string // score
}

export interface SearchIndex {
  season: number
  generated: string
  tournaments: IndexTournament[]
  players: IndexPlayer[]
  results: IndexResult[]
}

const EMPTY: SearchIndex = { season: 0, generated: '', tournaments: [], players: [], results: [] }

let cache: SearchIndex | null = null

export function loadIndex(): SearchIndex {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) as SearchIndex
  } catch {
    // Missing or unreadable index degrades search to empty rather than 500ing
    // the page it is mounted on. The staleness banner is what reports that the
    // pipeline has stopped publishing.
    cache = EMPTY
  }
  return cache
}

/** Rank a name match: prefix beats contains, and a surname prefix beats a forename one. */
function score(haystackName: string, q: string): number {
  const full = normalizeName(haystackName)
  if (!full.includes(q)) {
    const words = haystackName.split(/\s+/).map(normalizeName)
    return words.some(w => w.startsWith(q)) ? 40 : -1
  }
  if (full.startsWith(q)) return 100
  const words = haystackName.split(/\s+/).map(normalizeName)
  const last = words[words.length - 1] ?? ''
  if (last.startsWith(q)) return 80
  if (words.some(w => w.startsWith(q))) return 60
  return 20
}

export function searchTournaments(query: string, limit = 8): IndexTournament[] {
  const q = normalizeName(query)
  if (!q) return []
  return loadIndex()
    .tournaments.map(t => ({ t, s: score(t.name, q) }))
    .filter(x => x.s >= 0)
    // Same relevance: the more recent event is the one being asked about.
    .sort((a, b) => b.s - a.s || b.t.start.localeCompare(a.t.start))
    .slice(0, limit)
    .map(x => x.t)
}

export function searchPlayers(query: string, limit = 8): IndexPlayer[] {
  const q = normalizeName(query)
  if (!q) return []
  return loadIndex()
    .players.map(p => ({ p, s: score(p.name, q) }))
    .filter(x => x.s >= 0)
    // Ranked players first, then Elo — so "sin" surfaces Sinner, not a
    // 900th-ranked player whose name also contains those letters.
    .sort(
      (a, b) =>
        b.s - a.s ||
        (a.p.rank ?? 9999) - (b.p.rank ?? 9999) ||
        b.p.elo - a.p.elo,
    )
    .slice(0, limit)
    .map(x => x.p)
}

export function getTournament(slug: string): IndexTournament | null {
  return loadIndex().tournaments.find(t => t.slug === slug) ?? null
}

export function getIndexPlayer(id: string): IndexPlayer | null {
  return loadIndex().players.find(p => p.id === id) ?? null
}

/** Completed matches for one tournament, most recent first. */
export function tournamentResults(slug: string): IndexResult[] {
  return loadIndex().results.filter(r => r.s === slug)
}

/** Completed matches involving one player, most recent first. */
export function playerResults(id: string, limit?: number): IndexResult[] {
  const all = loadIndex().results.filter(r => r.w === id || r.l === id)
  return limit ? all.slice(0, limit) : all
}

/** Name lookup for rendering a result row without a second pass over the index. */
export function playerNames(): Map<string, IndexPlayer> {
  const m = new Map<string, IndexPlayer>()
  for (const p of loadIndex().players) m.set(p.id, p)
  return m
}
