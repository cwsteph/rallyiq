// src/lib/data/ratingToPlayer.ts
// Converts a DuckDB rating row into the Player shape the model expects.
// Centralised so every API route gets consistent transformation.

import type { Player, Surface } from '@/types'
import type { DBRating } from './duckdb'

export function ratingToPlayer(r: DBRating | any): Player {
  let form10: number[] = []
  try {
    form10 = typeof r.form_json === 'string' ? JSON.parse(r.form_json) : (r.form_json ?? [])
  } catch {
    form10 = []
  }

  return {
    id:           r.player_id,
    name:         r.name,
    tour:         (r.tour ?? 'ATP') as 'ATP' | 'WTA',
    nationality:  r.nationality ?? undefined,
    hand:         r.hand ?? undefined,
    eloOverall:   Number(r.elo_overall ?? 1500),
    eloHard:      Number(r.elo_hard    ?? 1500),
    eloClay:      Number(r.elo_clay    ?? 1500),
    eloGrass:     Number(r.elo_grass   ?? 1500),
    currentRank:  r.current_rank ? Number(r.current_rank) : undefined,
    holdPct:      Number(r.hold_pct    ?? 0.75),
    breakPct:     Number(r.break_pct   ?? 0.25),
    formScore:    Number(r.form_score  ?? 0.5),
    form10,
  }
}

/** Extract p1 + p2 Player objects from a joined today_matches row */
export function matchRowToPlayers(row: any): { p1: Player; p2: Player } {
  const p1: Player = {
    id:          row.player1_id,
    name:        row.player1_name,
    tour:        (row.tour ?? 'ATP') as 'ATP' | 'WTA',
    eloOverall:  Number(row.p1_elo_overall ?? 1500),
    eloHard:     Number(row.p1_elo_hard    ?? 1500),
    eloClay:     Number(row.p1_elo_clay    ?? 1500),
    eloGrass:    Number(row.p1_elo_grass   ?? 1500),
    currentRank: row.p1_rank ? Number(row.p1_rank) : undefined,
    holdPct:     Number(row.p1_hold_pct  ?? 0.75),
    breakPct:    Number(row.p1_break_pct ?? 0.25),
    formScore:   Number(row.p1_form_score ?? 0.5),
    form10:      safeParseForm(row.p1_form_json),
  }
  const p2: Player = {
    id:          row.player2_id,
    name:        row.player2_name,
    tour:        (row.tour ?? 'ATP') as 'ATP' | 'WTA',
    eloOverall:  Number(row.p2_elo_overall ?? 1500),
    eloHard:     Number(row.p2_elo_hard    ?? 1500),
    eloClay:     Number(row.p2_elo_clay    ?? 1500),
    eloGrass:    Number(row.p2_elo_grass   ?? 1500),
    currentRank: row.p2_rank ? Number(row.p2_rank) : undefined,
    holdPct:     Number(row.p2_hold_pct  ?? 0.75),
    breakPct:    Number(row.p2_break_pct ?? 0.25),
    formScore:   Number(row.p2_form_score ?? 0.5),
    form10:      safeParseForm(row.p2_form_json),
  }
  return { p1, p2 }
}

function safeParseForm(raw: any): number[] {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? []) }
  catch { return [] }
}
