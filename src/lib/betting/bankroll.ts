// src/lib/betting/bankroll.ts

export const STARTING_BANKROLL = 100
export const DEFAULT_BET_PCT   = 0.01   // 1%
export const MAX_BET_PCT       = 0.02   // 2%

export interface BankrollSummary {
  current: number
  starting: number
  totalPnl: number
  roi: number           // %
  winRate: number       // %
  wins: number
  losses: number
  pushes: number
  totalBets: number
  openBets: number
  avgEdge: number
  avgOdds: number
  maxDrawdown: number   // $ amount
  maxDrawdownPct: number
  currentStreak: number
  streakType: 'W' | 'L' | 'none'
  clvAvg: number
}

export interface BetRecord {
  id: string
  pnl: number
  result: 'WIN' | 'LOSS' | 'PUSH' | null
  edge: number
  odds: number
  closingOdds?: number
  status: 'OPEN' | 'SETTLED' | 'VOID'
}

export function computeBankrollSummary(
  currentBalance: number,
  bets: BetRecord[]
): BankrollSummary {
  const settled = bets.filter(b => b.status === 'SETTLED')
  const open = bets.filter(b => b.status === 'OPEN')

  const wins = settled.filter(b => b.result === 'WIN').length
  const losses = settled.filter(b => b.result === 'LOSS').length
  const pushes = settled.filter(b => b.result === 'PUSH').length

  const totalPnl = currentBalance - STARTING_BANKROLL
  const roi = (totalPnl / STARTING_BANKROLL) * 100
  const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0

  const avgEdge = settled.length > 0
    ? settled.reduce((s, b) => s + b.edge, 0) / settled.length * 100
    : 0

  const avgOdds = settled.length > 0
    ? settled.reduce((s, b) => s + b.odds, 0) / settled.length
    : 0

  // Max drawdown calculation
  let peak = STARTING_BANKROLL
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  let runningBalance = STARTING_BANKROLL
  for (const bet of settled) {
    runningBalance += (bet.pnl || 0)
    if (runningBalance > peak) peak = runningBalance
    const dd = peak - runningBalance
    const ddPct = (dd / peak) * 100
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownPct = ddPct
    }
  }

  // Current streak
  let currentStreak = 0
  let streakType: 'W' | 'L' | 'none' = 'none'
  const reversed = [...settled].reverse()
  for (const bet of reversed) {
    if (currentStreak === 0) {
      if (bet.result === 'WIN') { streakType = 'W'; currentStreak = 1 }
      else if (bet.result === 'LOSS') { streakType = 'L'; currentStreak = 1 }
      else break
    } else if (bet.result === 'WIN' && streakType === 'W') currentStreak++
    else if (bet.result === 'LOSS' && streakType === 'L') currentStreak++
    else break
  }

  // CLV average
  const clvBets = settled.filter(b => b.closingOdds != null)
  const clvAvg = clvBets.length > 0
    ? clvBets.reduce((s, b) => {
        const open = 1 / b.odds
        const close = 1 / (b.closingOdds!)
        return s + (close - open)
      }, 0) / clvBets.length * 100
    : 0

  return {
    current: currentBalance,
    starting: STARTING_BANKROLL,
    totalPnl,
    roi,
    winRate,
    wins,
    losses,
    pushes,
    totalBets: bets.length,
    openBets: open.length,
    avgEdge,
    avgOdds,
    maxDrawdown,
    maxDrawdownPct,
    currentStreak,
    streakType,
    clvAvg,
  }
}

export function getDefaultStake(bankroll: number, signal: string): number {
  if (signal === 'BET') return bankroll * DEFAULT_BET_PCT
  if (signal === 'LEAN') return bankroll * DEFAULT_BET_PCT * 0.5
  return 0
}
