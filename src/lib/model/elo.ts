// src/lib/model/elo.ts
import type { Surface, EloState } from '@/types'

export const BASE_ELO = 1500
export const K_FACTOR = 32         // standard K for tennis
export const K_FACTOR_EARLY = 40   // higher K for first 30 matches
export const K_SURFACE = 24        // slightly lower for surface-specific

interface EloUpdate {
  player1NewElo: number
  player2NewElo: number
  player1Change: number
  player2Change: number
}

/**
 * Expected win probability for player1 vs player2 using Elo
 */
export function eloExpected(elo1: number, elo2: number): number {
  return 1 / (1 + Math.pow(10, (elo2 - elo1) / 400))
}

/**
 * Update Elo ratings after a match
 * player1 is the winner
 */
export function updateElo(
  elo1: number,
  elo2: number,
  k: number = K_FACTOR
): EloUpdate {
  const expected1 = eloExpected(elo1, elo2)
  const expected2 = 1 - expected1

  // Winner scores 1, loser scores 0
  const change1 = k * (1 - expected1)
  const change2 = k * (0 - expected2)

  return {
    player1NewElo: Math.round((elo1 + change1) * 10) / 10,
    player2NewElo: Math.round((elo2 + change2) * 10) / 10,
    player1Change: Math.round(change1 * 10) / 10,
    player2Change: Math.round(change2 * 10) / 10,
  }
}

/**
 * Update surface-specific Elo
 */
export function updateSurfaceElo(
  elo1: number,
  elo2: number,
  surface: Surface
): EloUpdate {
  // Carpet treated like hard
  const k = surface === 'Carpet' ? K_SURFACE : K_SURFACE
  return updateElo(elo1, elo2, k)
}

/**
 * Compute overall win probability using combined Elo signals
 */
export function eloWinProbability(
  p1Elo: EloState,
  p2Elo: EloState,
  surface: Surface
): number {
  const surfaceKey = surface === 'Hard' || surface === 'Carpet' ? 'hard'
    : surface === 'Clay' ? 'clay' : 'grass'

  const p1SurfElo = p1Elo[surfaceKey as keyof EloState]
  const p2SurfElo = p2Elo[surfaceKey as keyof EloState]

  // Weighted blend: 60% surface Elo, 40% overall
  const p1Blended = 0.6 * p1SurfElo + 0.4 * p1Elo.overall
  const p2Blended = 0.6 * p2SurfElo + 0.4 * p2Elo.overall

  return eloExpected(p1Blended, p2Blended)
}

/**
 * Get the appropriate K factor based on career matches played
 */
export function getKFactor(matchesPlayed: number, isSurface = false): number {
  const base = isSurface ? K_SURFACE : K_FACTOR
  const earlyBase = isSurface ? K_SURFACE + 8 : K_FACTOR_EARLY
  return matchesPlayed < 30 ? earlyBase : base
}

/**
 * Convert Elo diff to rough probability without full Elo objects
 */
export function eloDiffToProb(eloDiff: number): number {
  return 1 / (1 + Math.pow(10, -eloDiff / 400))
}
