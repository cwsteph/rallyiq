// src/lib/model/surfaceElo.ts
// Surface-specific Elo utilities and surface win-rate weighting

import type { Surface } from '@/types'

/**
 * Surface affinity score: how much better/worse a player performs
 * on a given surface relative to their overall level.
 *
 * Positive = surface specialist, negative = struggles on surface
 */
export function surfaceAffinity(
  surfaceElo: number,
  overallElo: number
): number {
  return surfaceElo - overallElo
}

/**
 * Blended Elo for a matchup, weighting surface vs overall Elo.
 * When surface sample is thin (few surface matches), blend more toward overall.
 */
export function blendedElo(
  overallElo: number,
  surfaceElo: number,
  surfaceMatchCount: number,
  maxWeight = 0.65,
  minMatches = 20
): number {
  // Ramp from 0 weight at 0 matches to maxWeight at minMatches+
  const weight = Math.min(maxWeight, (surfaceMatchCount / minMatches) * maxWeight)
  return overallElo * (1 - weight) + surfaceElo * weight
}

/**
 * Surface type groupings for analysis
 */
export const SURFACE_GROUPS = {
  fast: ['Grass', 'Carpet'],
  medium: ['Hard'],
  slow: ['Clay'],
} as const

export function surfaceSpeed(surface: Surface): 'fast' | 'medium' | 'slow' {
  if (surface === 'Grass' || surface === 'Carpet') return 'fast'
  if (surface === 'Clay') return 'slow'
  return 'medium'
}

/**
 * Speed adjustment to serve/return stats.
 * Fast courts amplify serve advantage; clay amplifies return/baseline.
 */
export function speedFactor(surface: Surface): { serveBonus: number; returnBonus: number } {
  switch (surfaceSpeed(surface)) {
    case 'fast':   return { serveBonus:  0.03, returnBonus: -0.02 }
    case 'slow':   return { serveBonus: -0.02, returnBonus:  0.02 }
    case 'medium': return { serveBonus:  0.00, returnBonus:  0.00 }
  }
}
