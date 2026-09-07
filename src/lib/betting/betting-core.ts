/**
 * BettingCore — Shared betting math library
 * Used by PaddockIQ (horse racing) and RallyIQ (tennis)
 *
 * Covers: Kelly criterion, edge detection, bankroll summary,
 *         CLV tracking, drawdown, streak analysis
 *
 * This is the TypeScript source-of-truth. The JS version at
 * paddockiq/public/lib/betting-core.js mirrors this logic as
 * a browser-global (window.BettingCore).
 */

// ── Types ──────────────────────────────────────────────────

export type Signal = 'BET' | 'LEAN' | 'PASS'
export type StreakType = 'W' | 'L' | 'none'

export interface EdgeResult {
  modelProb: number
  impliedProb: number
  edge: number
  signal: Signal
  kellyFraction: number
}

export interface BetRecord {
  pnl: number
  result: 'WIN' | 'LOSS' | 'PUSH' | null
  status: 'OPEN' | 'SETTLED' | 'VOID'
  edge?: number
  odds?: number
  closingOdds?: number
  amount?: number
}

export interface BankrollSummary {
  current: number
  starting: number
  totalPnl: number
  roi: number
  winRate: number
  wins: number
  losses: number
  pushes: number
  totalBets: number
  openBets: number
  settledBets: number
  totalWagered: number
  avgEdge: number
  avgOdds: number
  maxDrawdown: number
  maxDrawdownPct: number
  currentStreak: number
  streakType: StreakType
  clvAvg: number
}

export interface DayDrawdown {
  maxDrawdown: number
  maxDrawdownPct: number
  peak: number
}

export interface StakeOptions {
  kellyFraction?: number
  maxBetPct?: number
  minBet?: number
  signal?: string
}

export interface EdgeThresholds {
  bet?: number
  lean?: number
  minConf?: number
}

// ── Odds Conversion ────────────────────────────────────────

/** Morning-line string "4-1" → decimal odds 5.0 */
export function mlToDecimal(ml: string | number): number {
  if (typeof ml === 'number') return ml
  const p = String(ml || '4-1').split('-')
  return parseFloat(p[1]) > 0 ? parseFloat(p[0]) / parseFloat(p[1]) + 1 : 5.0
}

/** Decimal odds → implied probability */
export function decimalToImplied(decimalOdds: number): number {
  return decimalOdds > 0 ? 1 / decimalOdds : 0
}

/** Implied probability → decimal odds */
export function impliedToDecimal(prob: number): number {
  return prob > 0 ? 1 / prob : 100
}

/** American odds → decimal odds */
export function americanToDecimal(american: number): number {
  if (american >= 100) return american / 100 + 1
  if (american <= -100) return 100 / Math.abs(american) + 1
  return 2.0
}

/** Decimal odds → American odds */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

// ── Kelly Criterion ────────────────────────────────────────

/** Full Kelly fraction: f* = (bp - q) / b */
export function fullKelly(prob: number, decimalOdds: number): number {
  if (decimalOdds <= 1 || prob <= 0 || prob >= 1) return 0
  const b = decimalOdds - 1
  const q = 1 - prob
  return Math.max(0, (prob * b - q) / b)
}

/** Fractional Kelly — safer for real-world use */
export function fractionalKelly(
  prob: number,
  decimalOdds: number,
  fraction = 0.25
): number {
  return fullKelly(prob, decimalOdds) * fraction
}

/** Parallel Kelly — scale down when betting multiple events */
export function parallelKelly(
  bets: Array<{ prob: number; decimalOdds: number }>,
  fraction = 0.25
): number[] {
  const total = bets.reduce(
    (s, b) => s + fractionalKelly(b.prob, b.decimalOdds, fraction),
    0
  )
  const scale = total > 0.2 ? 0.2 / total : 1
  return bets.map(b => fractionalKelly(b.prob, b.decimalOdds, fraction) * scale)
}

/** Recommended stake in $ with safety cap */
export function recommendedStake(
  bankroll: number,
  prob: number,
  decimalOdds: number,
  options: StakeOptions = {}
): number {
  const {
    kellyFraction = 0.25,
    maxBetPct = 0.20,
    minBet = 2,
    signal = 'BET',
  } = options

  if (signal === 'PASS') return 0

  const kellyStake = bankroll * fractionalKelly(prob, decimalOdds, kellyFraction)
  const maxStake = bankroll * maxBetPct
  const signalMult = signal === 'LEAN' ? 0.5 : 1.0

  const raw = Math.min(kellyStake, maxStake) * signalMult
  if (raw < minBet) return 0
  return Math.max(minBet, Math.round(raw))
}

/** Fixed-fraction staking (alternative to Kelly) */
export function fixedFraction(bankroll: number, fraction = 0.01): number {
  return bankroll * fraction
}

// ── Edge Detection ─────────────────────────────────────────

/** Compute edge between model probability and market odds */
export function computeEdge(
  modelProb: number,
  marketDecimalOdds: number,
  thresholds: EdgeThresholds = {}
): EdgeResult {
  const { bet: minBet = 0.02, lean: minLean = 0.01, minConf = 0.51 } = thresholds
  const impliedProb = decimalToImplied(marketDecimalOdds)
  const edge = modelProb - impliedProb
  let signal: Signal = 'PASS'
  if (modelProb >= minConf) {
    if (edge >= minBet) signal = 'BET'
    else if (edge >= minLean) signal = 'LEAN'
  }
  return { modelProb, impliedProb, edge, signal, kellyFraction: fullKelly(modelProb, marketDecimalOdds) }
}

/** Expected value of a bet */
export function expectedValue(
  stake: number,
  modelProb: number,
  decimalOdds: number
): number {
  const toWin = stake * (decimalOdds - 1)
  return modelProb * toWin - (1 - modelProb) * stake
}

// ── CLV (Closing Line Value) ───────────────────────────────

/** Positive CLV = you got a better price than the market settled at */
export function computeCLV(openingOdds: number, closingOdds: number): number {
  if (!openingOdds || !closingOdds || openingOdds <= 0 || closingOdds <= 0) return 0
  return decimalToImplied(closingOdds) - decimalToImplied(openingOdds)
}

// ── Bankroll Summary ───────────────────────────────────────

/** Compute comprehensive bankroll summary from bet history */
export function computeBankrollSummary(
  currentBalance: number,
  startingBankroll: number,
  bets: BetRecord[]
): BankrollSummary {
  const settled = bets.filter(b => b.status === 'SETTLED')
  const open = bets.filter(b => b.status === 'OPEN')

  const wins = settled.filter(b => b.result === 'WIN').length
  const losses = settled.filter(b => b.result === 'LOSS').length
  const pushes = settled.filter(b => b.result === 'PUSH').length

  const totalPnl = currentBalance - startingBankroll
  const roi = startingBankroll > 0 ? (totalPnl / startingBankroll) * 100 : 0
  const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0

  const edgeBets = settled.filter(b => b.edge != null)
  const avgEdge = edgeBets.length > 0
    ? (edgeBets.reduce((s, b) => s + (b.edge ?? 0), 0) / edgeBets.length) * 100
    : 0

  const oddsBets = settled.filter(b => b.odds != null && b.odds! > 0)
  const avgOdds = oddsBets.length > 0
    ? oddsBets.reduce((s, b) => s + (b.odds ?? 0), 0) / oddsBets.length
    : 0

  // Max drawdown
  let peak = startingBankroll
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  let runningBalance = startingBankroll
  for (const bet of settled) {
    runningBalance += bet.pnl || 0
    if (runningBalance > peak) peak = runningBalance
    const dd = peak - runningBalance
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownPct = ddPct
    }
  }

  // Current streak
  let currentStreak = 0
  let streakType: StreakType = 'none'
  for (let j = settled.length - 1; j >= 0; j--) {
    const r = settled[j].result
    if (currentStreak === 0) {
      if (r === 'WIN') { streakType = 'W'; currentStreak = 1 }
      else if (r === 'LOSS') { streakType = 'L'; currentStreak = 1 }
      else break
    } else if (r === 'WIN' && streakType === 'W') currentStreak++
    else if (r === 'LOSS' && streakType === 'L') currentStreak++
    else break
  }

  // CLV average
  const clvBets = settled.filter(b => b.closingOdds != null && b.odds != null)
  const clvAvg = clvBets.length > 0
    ? (clvBets.reduce((s, b) => s + computeCLV(b.odds!, b.closingOdds!), 0) / clvBets.length) * 100
    : 0

  const totalWagered = settled.reduce((s, b) => s + (b.amount || 0), 0)

  return {
    current: currentBalance,
    starting: startingBankroll,
    totalPnl,
    roi,
    winRate,
    wins,
    losses,
    pushes,
    totalBets: bets.length,
    openBets: open.length,
    settledBets: settled.length,
    totalWagered,
    avgEdge,
    avgOdds,
    maxDrawdown,
    maxDrawdownPct,
    currentStreak,
    streakType,
    clvAvg,
  }
}

/** Compute drawdown from day-level history */
export function computeDayDrawdown(
  dayHistory: Array<{ bankroll: number }>,
  startingBankroll: number
): DayDrawdown {
  let peak = startingBankroll
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  for (const day of dayHistory) {
    const bal = day.bankroll || 0
    if (bal > peak) peak = bal
    const dd = peak - bal
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownPct = ddPct
    }
  }
  return { maxDrawdown, maxDrawdownPct, peak }
}
