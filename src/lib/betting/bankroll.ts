// src/lib/betting/bankroll.ts
// Re-exports from shared betting-core for backwards compatibility

import {
  computeBankrollSummary as coreComputeBankrollSummary,
  type BetRecord as CoreBetRecord,
  type BankrollSummary,
} from './betting-core'

export type { BankrollSummary } from './betting-core'

export const STARTING_BANKROLL = 100
export const DEFAULT_BET_PCT   = 0.01   // 1%
export const MAX_BET_PCT       = 0.02   // 2%

export interface BetRecord {
  id: string
  pnl: number
  result: 'WIN' | 'LOSS' | 'PUSH' | null
  edge: number
  odds: number
  closingOdds?: number
  stake?: number
  status: 'OPEN' | 'SETTLED' | 'VOID'
}

export function computeBankrollSummary(
  currentBalance: number,
  bets: BetRecord[]
): BankrollSummary {
  // Map RallyIQ BetRecord to core BetRecord format
  const coreBets: CoreBetRecord[] = bets.map(b => ({
    pnl: b.pnl,
    result: b.result,
    status: b.status as 'OPEN' | 'SETTLED' | 'VOID',
    edge: b.edge,
    odds: b.odds,
    closingOdds: b.closingOdds,
    // core calls it `amount`; without it totalWagered reports $0 forever
    amount: b.stake,
  }))
  return coreComputeBankrollSummary(currentBalance, STARTING_BANKROLL, coreBets)
}

export function getDefaultStake(bankroll: number, signal: string): number {
  if (signal === 'BET') return bankroll * DEFAULT_BET_PCT
  if (signal === 'LEAN') return bankroll * DEFAULT_BET_PCT * 0.5
  return 0
}
