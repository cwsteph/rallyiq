// src/types/index.ts

export type Tour = 'ATP' | 'WTA'
export type Surface = 'Hard' | 'Clay' | 'Grass' | 'Carpet'
export type Signal = 'BET' | 'LEAN' | 'PASS'
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED'
export type BetStatus = 'OPEN' | 'SETTLED' | 'VOID' | 'CANCELLED'
export type BetResult = 'WIN' | 'LOSS' | 'PUSH'

export interface Player {
  id: string
  name: string
  tour: Tour
  nationality?: string
  hand?: string
  eloOverall: number
  eloHard: number
  eloClay: number
  eloGrass: number
  currentRank?: number
  holdPct?: number
  breakPct?: number
  returnHoldPct?: number
  form10?: number[]
  formScore?: number
}

export interface Match {
  id: string
  tournament: string
  surface: Surface
  round: string
  bestOf: number
  matchDate: string
  status: MatchStatus
  player1: Player
  player2: Player
  winnerId?: string
  score?: string
  modelProb1?: number
  impliedProb1?: number
  edge1?: number
  signal?: Signal
  fairOdds1?: number
  fairOdds2?: number
  marketOdds1?: number
  marketOdds2?: number
  simProb1?: number
  simGamesAvg?: number
}

export interface MatchAnalysis {
  matchId: string
  player1: Player
  player2: Player
  surface: Surface
  modelProb1: number
  modelProb2: number
  impliedProb1: number
  impliedProb2: number
  edge1: number
  edge2: number
  fairOdds1: number
  fairOdds2: number
  fairOddsAmerican1: string
  fairOddsAmerican2: string
  marketOdds1: number
  marketOdds2: number
  signal: Signal
  kellyFraction: number
  suggestedStake: number
  factors: ModelFactors
}

export interface ModelFactors {
  surfaceEloDiff: number
  overallEloDiff: number
  recentFormDiff: number
  serveReturnDiff: number
  fatigueDiff: number
  totalStrength: number
}

export interface SimulationResult {
  winProb1: number
  winProb2: number
  avgGames: number
  gamesDistribution: Record<string, number>
  spreadCoverPct: number
  over21Pct: number
  iterations: number
}

export interface BankrollStats {
  currentBalance: number
  startingBalance: number
  totalPnl: number
  roi: number
  winRate: number
  totalBets: number
  openBets: number
  avgEdge: number
  maxDrawdown: number
  clvAvg: number
}

export interface ParsedMatch {
  externalId: string
  tournament: string
  surface: Surface
  round: string
  bestOf: number
  matchDate: Date
  player1Name: string
  player2Name: string
  player1Id: string
  player2Id: string
  winnerId: string
  score: string
  // Serve stats p1
  p1Aces: number
  p1Dfs: number
  p1SvptWon: number
  p1BpFaced: number
  p1BpSaved: number
  // Serve stats p2
  p2Aces: number
  p2Dfs: number
  p2SvptWon: number
  p2BpFaced: number
  p2BpSaved: number
}

export interface EloState {
  overall: number
  hard: number
  clay: number
  grass: number
}

export interface EdgeResult {
  modelProb: number
  impliedProb: number
  edge: number
  signal: Signal
  kellyFraction: number
}
