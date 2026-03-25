// src/lib/betting/kelly.ts
// Full Kelly criterion implementation and staking plan utilities

/**
 * Full Kelly fraction
 * f* = (bp - q) / b
 * where b = net_odds (decimal - 1), p = win prob, q = lose prob
 */
export function fullKelly(prob: number, decimalOdds: number): number {
  if (decimalOdds <= 1 || prob <= 0 || prob >= 1) return 0
  const b = decimalOdds - 1
  const q = 1 - prob
  return Math.max(0, (prob * b - q) / b)
}

/**
 * Fractional Kelly — safer for real-world use
 * fraction = 0.25 (quarter Kelly) is standard conservative setting
 */
export function fractionalKelly(
  prob: number,
  decimalOdds: number,
  fraction = 0.25
): number {
  return fullKelly(prob, decimalOdds) * fraction
}

/**
 * Optimal f* for simultaneous bets (simplified)
 * When betting multiple events in parallel, reduce each stake
 */
export function parallelKelly(
  bets: Array<{ prob: number; decimalOdds: number }>,
  fraction = 0.25
): number[] {
  const total = bets.reduce(
    (sum, b) => sum + fractionalKelly(b.prob, b.decimalOdds, fraction),
    0
  )
  // If total > 1 (over-betting), scale down proportionally
  const scale = total > 0.2 ? 0.2 / total : 1
  return bets.map(b => fractionalKelly(b.prob, b.decimalOdds, fraction) * scale)
}

/**
 * Fixed-fraction staking (alternative to Kelly)
 * Simpler but ignores edge size
 */
export function fixedFraction(bankroll: number, fraction = 0.01): number {
  return bankroll * fraction
}

/**
 * Level stakes (flat betting)
 */
export function levelStakes(fixedAmount: number): number {
  return fixedAmount
}

/**
 * Recommended stake in $ with safety cap
 */
export function recommendedStake(
  bankroll: number,
  prob: number,
  decimalOdds: number,
  options: {
    kellyFraction?: number
    maxBetPct?: number
    minBet?: number
    signal?: string
  } = {}
): number {
  const {
    kellyFraction = 0.25,
    maxBetPct = 0.02,
    minBet = 0.50,
    signal = 'BET',
  } = options

  if (signal === 'PASS') return 0

  const kellyStake = bankroll * fractionalKelly(prob, decimalOdds, kellyFraction)
  const maxStake = bankroll * maxBetPct
  // LEAN gets half the normal recommended stake
  const signalMultiplier = signal === 'LEAN' ? 0.5 : 1.0

  const raw = Math.min(kellyStake, maxStake) * signalMultiplier
  if (raw < minBet) return 0
  return Math.round(raw * 100) / 100
}
