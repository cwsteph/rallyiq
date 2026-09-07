// src/lib/betting/edge.ts
// Re-exports core functions from shared betting-core,
// plus sport-specific wrappers that depend on probability.ts

import type { Signal } from '@/types'
import { decimalToImplied } from '../model/probability'
import {
  fullKelly,
  fractionalKelly,
  computeCLV as coreCLV,
  expectedValue as coreEV,
  computeEdge as coreComputeEdge,
} from './betting-core'

export type { EdgeResult } from './betting-core'

const MIN_EDGE_BET  = 0.02
const MIN_EDGE_LEAN = 0.01
const MIN_CONFIDENCE = 0.51

/**
 * Compute edge and signal for a single side
 * (Uses shared core with RallyIQ-specific thresholds)
 */
export function computeEdge(
  modelProb: number,
  marketDecimalOdds: number
) {
  return coreComputeEdge(modelProb, marketDecimalOdds, {
    bet: MIN_EDGE_BET,
    lean: MIN_EDGE_LEAN,
    minConf: MIN_CONFIDENCE,
  })
}

/** Full Kelly — re-exported from core */
export { fullKelly as kellyStake }

/** Fractional Kelly — re-exported from core */
export { fractionalKelly }

/**
 * Suggested stake in dollars given bankroll and Kelly
 */
export function suggestedStake(
  bankroll: number,
  prob: number,
  decimalOdds: number,
  maxBetPct = 0.02,
  fraction = 0.25
): number {
  const kelly = fractionalKelly(prob, decimalOdds, fraction)
  const raw = bankroll * kelly
  const maxBet = bankroll * maxBetPct
  return Math.min(raw, maxBet)
}

/** CLV — re-exported from core */
export const computeCLV = coreCLV

/** Expected value — re-exported from core */
export const expectedValue = coreEV
