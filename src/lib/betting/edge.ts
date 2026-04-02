// src/lib/betting/edge.ts
import type { Signal, EdgeResult } from '@/types'
import { toDecimalOdds, toAmericanOdds, decimalToImplied } from '../model/probability'

const MIN_EDGE_BET  = 0.02   // 2% edge to BET  (was 5%)
const MIN_EDGE_LEAN = 0.01   // 1% edge to LEAN (was 2%)
const MIN_CONFIDENCE = 0.51  // 51% minimum model confidence (was 52%)

/**
 * Compute edge and signal for a single side
 */
export function computeEdge(
  modelProb: number,
  marketDecimalOdds: number
): EdgeResult {
  const impliedProb = decimalToImplied(marketDecimalOdds)
  const edge = modelProb - impliedProb
  let signal: Signal = 'PASS'
  if (modelProb >= MIN_CONFIDENCE) {
    if (edge >= MIN_EDGE_BET) signal = 'BET'
    else if (edge >= MIN_EDGE_LEAN) signal = 'LEAN'
  }
  const kellyFraction = kellyStake(modelProb, marketDecimalOdds)
  return { modelProb, impliedProb, edge, signal, kellyFraction }
}

/**
 * Full Kelly criterion
 * f = (bp - q) / b  where b = decimal_odds - 1, p = win prob, q = 1 - p
 */
export function kellyStake(prob: number, decimalOdds: number): number {
  const b = decimalOdds - 1
  const q = 1 - prob
  const f = (prob * b - q) / b
  return Math.max(0, f)
}

/**
 * Fractional Kelly (recommended: 25% of full Kelly)
 */
export function fractionalKelly(
  prob: number,
  decimalOdds: number,
  fraction = 0.25
): number {
  return kellyStake(prob, decimalOdds) * fraction
}

/**
 * Suggested stake in dollars given bankroll and Kelly
 */
export function suggestedStake(
  bankroll: number,
  prob: number,
  decimalOdds: number,
  maxBetPct = 0.02,  // max 2% of bankroll
  fraction = 0.25
): number {
  const kelly = fractionalKelly(prob, decimalOdds, fraction)
  const raw = bankroll * kelly
  const maxBet = bankroll * maxBetPct
  return Math.min(raw, maxBet)
}

/**
 * Closing Line Value - how much better our odds were vs closing line
 * Positive CLV = we got the better of the market
 */
export function computeCLV(
  openingOdds: number,
  closingOdds: number
): number {
  const openingProb = decimalToImplied(openingOdds)
  const closingProb = decimalToImplied(closingOdds)
  return closingProb - openingProb  // positive = we had better price
}

/**
 * Expected value of a bet
 */
export function expectedValue(
  stake: number,
  modelProb: number,
  decimalOdds: number
): number {
  const toWin = stake * (decimalOdds - 1)
  return (modelProb * toWin) - ((1 - modelProb) * stake)
}