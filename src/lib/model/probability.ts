// src/lib/model/probability.ts
import type { Player, Surface, ModelFactors, EloState } from '@/types'
import { eloExpected, eloDiffToProb } from './elo'
import { formDiff, serveReturnDiff } from './form'

// Weights must sum to 1.0
const WEIGHTS = {
  surfaceElo: 0.35,
  overallElo: 0.20,
  recentForm: 0.20,
  serveReturn: 0.15,
  fatigue:     0.10,
}

const LOGISTIC_K = 0.6

/**
 * Logistic function to convert strength diff to probability
 */
function logistic(x: number): number {
  return 1 / (1 + Math.exp(-LOGISTIC_K * x))
}

function getSurfaceElo(player: Player, surface: Surface): number {
  switch (surface) {
    case 'Hard':    return player.eloHard
    case 'Clay':    return player.eloClay
    case 'Grass':   return player.eloGrass
    case 'Carpet':  return player.eloHard
    default:        return player.eloOverall
  }
}

/**
 * Compute comprehensive win probability for player1 vs player2
 */
export function computeWinProbability(
  p1: Player,
  p2: Player,
  surface: Surface,
  p1FatigueDays = 0,
  p2FatigueDays = 0
): { probability: number; factors: ModelFactors } {
  // Surface Elo difference, normalized to ~[-1, 1] range
  const p1SurfElo = getSurfaceElo(p1, surface)
  const p2SurfElo = getSurfaceElo(p2, surface)
  const surfaceEloDiff = (p1SurfElo - p2SurfElo) / 200

  // Overall Elo difference
  const overallEloDiff = (p1.eloOverall - p2.eloOverall) / 200

  // Recent form (last 10 matches)
  const form1 = p1.form10 as number[] || []
  const form2 = p2.form10 as number[] || []
  const recentFormDiff = formDiff(form1, form2)

  // Serve + return composite
  const serveReturnDiff_val = serveReturnDiff(p1, p2)
  const serveReturnDiffNorm = serveReturnDiff_val * 3

  // Fatigue: days since last match (fewer = more tired)
  const fatigueDiff = (p2FatigueDays - p1FatigueDays) / 7

  // Weighted strength score
  const totalStrength =
    WEIGHTS.surfaceElo  * surfaceEloDiff +
    WEIGHTS.overallElo  * overallEloDiff +
    WEIGHTS.recentForm  * recentFormDiff +
    WEIGHTS.serveReturn * serveReturnDiffNorm +
    WEIGHTS.fatigue     * fatigueDiff

  const probability = logistic(totalStrength)

  const factors: ModelFactors = {
    surfaceEloDiff: surfaceEloDiff,
    overallEloDiff: overallEloDiff,
    recentFormDiff: recentFormDiff,
    serveReturnDiff: serveReturnDiff_val,
    fatigueDiff: fatigueDiff,
    totalStrength: totalStrength,
  }

  return {
    probability: Math.max(0.05, Math.min(0.95, probability)),
    factors,
  }
}

/**
 * Convert win probability to decimal odds
 */
export function toDecimalOdds(prob: number): number {
  if (prob <= 0) return 999
  return Math.round((1 / prob) * 100) / 100
}

/**
 * Convert win probability to American odds string
 */
export function toAmericanOdds(prob: number): string {
  if (prob >= 0.5) {
    return `-${Math.round((prob / (1 - prob)) * 100)}`
  }
  return `+${Math.round(((1 - prob) / prob) * 100)}`
}

/**
 * Convert decimal odds to implied probability (with vig)
 */
export function decimalToImplied(decOdds: number): number {
  if (decOdds <= 1) return 0.99
  return 1 / decOdds
}

/**
 * Remove vig from a pair of odds to get fair implied probs
 */
export function removeVig(decOdds1: number, decOdds2: number): [number, number] {
  const raw1 = decimalToImplied(decOdds1)
  const raw2 = decimalToImplied(decOdds2)
  const total = raw1 + raw2
  return [raw1 / total, raw2 / total]
}
