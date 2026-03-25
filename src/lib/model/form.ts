// src/lib/model/form.ts
import type { Player } from '@/types'

/**
 * Compute recent form score from last N match results
 * Results: array of 1 (win) or 0 (loss), most recent first
 */
export function computeFormScore(results: number[], n = 10): number {
  if (!results || results.length === 0) return 0.5
  const recent = results.slice(0, n)
  // Weight more recent results higher
  let weightedSum = 0
  let totalWeight = 0
  recent.forEach((result, i) => {
    const weight = Math.pow(0.85, i) // decay
    weightedSum += result * weight
    totalWeight += weight
  })
  return totalWeight > 0 ? weightedSum / totalWeight : 0.5
}

/**
 * Form difference between two players, normalized to [-1, 1]
 */
export function formDiff(p1Form: number[], p2Form: number[]): number {
  const f1 = computeFormScore(p1Form)
  const f2 = computeFormScore(p2Form)
  return f1 - f2
}

// src/lib/model/holdBreak.ts

/**
 * Compute hold percentage from serve stats
 * hold% = (svpt won on serve - bp lost) / service games, simplified to:
 * hold% = 1 - (bp faced - bp saved) / service games
 */
export function computeHoldPct(bpFaced: number, bpSaved: number, serviceGames: number): number {
  if (serviceGames === 0) return 0
  const breaksSuffered = bpFaced - bpSaved
  return Math.max(0, Math.min(1, 1 - breaksSuffered / serviceGames))
}

/**
 * Compute break percentage from return stats
 * break% = (bp converted) / (bp opportunities)
 */
export function computeBreakPct(bpConverted: number, bpOpportunities: number): number {
  if (bpOpportunities === 0) return 0
  return Math.max(0, Math.min(1, bpConverted / bpOpportunities))
}

/**
 * Serve+Return composite rating
 * Higher = better server/returner
 */
export function serveReturnRating(player: Player): number {
  const hold = player.holdPct ?? 0.75
  const breakRate = player.breakPct ?? 0.25
  // Normalized: hold contributes 60%, break 40%
  return 0.6 * hold + 0.4 * breakRate
}

/**
 * Serve-return differential between two players
 * Positive = player1 has better serve+return composite
 */
export function serveReturnDiff(p1: Player, p2: Player): number {
  return serveReturnRating(p1) - serveReturnRating(p2)
}

/**
 * Rolling average of a stat over N matches
 */
export function rollingAvg(values: number[], n = 10): number {
  if (!values || values.length === 0) return 0
  const recent = values.slice(-n)
  return recent.reduce((a, b) => a + b, 0) / recent.length
}
