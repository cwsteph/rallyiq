// src/lib/betting/kelly.ts
// Kelly math comes from the shared core; the staking policy is RallyIQ's own.

import { fractionalKelly, type StakeOptions } from './betting-core'
import { MAX_BET_PCT } from './bankroll'

export {
  fullKelly,
  fractionalKelly,
  parallelKelly,
  fixedFraction,
} from './betting-core'

/**
 * Recommended stake in $ with safety cap.
 *
 * Deliberately not betting-core's `recommendedStake`: that one defaults to
 * PaddockIQ's policy — 20% of bankroll, $2 minimum, whole-dollar rounding.
 * RallyIQ runs a $100 bankroll and caps at MAX_BET_PCT (2%), and its stakes are
 * priced in cents. Inheriting the core defaults would return ten times the cap
 * declared beside it in bankroll.ts. The Kelly fraction itself is still shared.
 */
export function recommendedStake(
  bankroll: number,
  prob: number,
  decimalOdds: number,
  options: StakeOptions = {}
): number {
  const {
    kellyFraction = 0.25,
    maxBetPct = MAX_BET_PCT,
    minBet = 0.5,
    signal = 'BET',
  } = options

  if (signal === 'PASS') return 0

  const kellyStake = bankroll * fractionalKelly(prob, decimalOdds, kellyFraction)
  const maxStake = bankroll * maxBetPct
  const signalMultiplier = signal === 'LEAN' ? 0.5 : 1.0

  const raw = Math.min(kellyStake, maxStake) * signalMultiplier
  if (raw < minBet) return 0
  return Math.round(raw * 100) / 100
}

/** Level stakes (flat betting) */
export function levelStakes(fixedAmount: number): number {
  return fixedAmount
}
