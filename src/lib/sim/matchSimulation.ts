// src/lib/sim/matchSimulation.ts
import type { Player, Surface, SimulationResult } from '@/types'

const DEFAULT_ITERATIONS = 10_000

interface SimInput {
  p1HoldPct: number   // probability player1 holds serve
  p2HoldPct: number
  bestOf: 3 | 5
}

interface SetResult {
  p1Games: number
  p2Games: number
  winner: 1 | 2
}

interface MatchResult {
  winner: 1 | 2
  totalGames: number
  sets: SetResult[]
}

/**
 * Simulate a single service game
 * Returns true if server wins
 */
function simulateServiceGame(holdPct: number): boolean {
  return Math.random() < holdPct
}

/**
 * Simulate a tiebreak
 * Uses point-by-point with equal probability (simplified)
 */
function simulateTiebreak(p1ServePct: number, p2ServePct: number): 1 | 2 {
  let p1Points = 0
  let p2Points = 0
  // Alternate serve in tiebreak
  let server: 1 | 2 = 1
  let gamesInTb = 0

  while (true) {
    const holdPct = server === 1 ? p1ServePct : p2ServePct
    const serverWins = Math.random() < holdPct

    if (server === 1) {
      if (serverWins) p1Points++; else p2Points++
    } else {
      if (serverWins) p2Points++; else p1Points++
    }
    gamesInTb++
    // Switch server every 2 points (first after 1)
    if (gamesInTb === 1 || gamesInTb % 2 === 0) {
      server = server === 1 ? 2 : 1
    }

    if (p1Points >= 7 && p1Points - p2Points >= 2) return 1
    if (p2Points >= 7 && p2Points - p1Points >= 2) return 2
    if (p1Points > 15 || p2Points > 15) {
      // Safety valve
      return p1Points > p2Points ? 1 : 2
    }
  }
}

/**
 * Simulate a single set
 */
function simulateSet(
  p1Hold: number,
  p2Hold: number,
  isFinalSet = false,
  finalSetTiebreak = true
): SetResult {
  let p1Games = 0
  let p2Games = 0
  let server: 1 | 2 = 1 // player1 serves first

  while (true) {
    const holdPct = server === 1 ? p1Hold : p2Hold
    const serverWins = simulateServiceGame(holdPct)

    if (server === 1) {
      if (serverWins) p1Games++; else p2Games++
    } else {
      if (serverWins) p2Games++; else p1Games++
    }

    // Switch server
    server = server === 1 ? 2 : 1

    // Check for set win
    if (p1Games >= 6 && p1Games - p2Games >= 2) {
      return { p1Games, p2Games, winner: 1 }
    }
    if (p2Games >= 6 && p2Games - p1Games >= 2) {
      return { p1Games, p2Games, winner: 2 }
    }

    // Tiebreak at 6-6
    if (p1Games === 6 && p2Games === 6) {
      if (isFinalSet && !finalSetTiebreak) {
        // Super tiebreak / advantage set (keep playing)
        continue
      }
      const tbWinner = simulateTiebreak(p1Hold, p2Hold)
      if (tbWinner === 1) {
        return { p1Games: 7, p2Games: 6, winner: 1 }
      } else {
        return { p1Games: 6, p2Games: 7, winner: 2 }
      }
    }
  }
}

/**
 * Simulate a full match
 */
function simulateMatch(input: SimInput): MatchResult {
  const { p1HoldPct, p2HoldPct, bestOf } = input
  const setsToWin = bestOf === 5 ? 3 : 2

  let p1Sets = 0
  let p2Sets = 0
  let totalGames = 0
  const sets: SetResult[] = []

  while (p1Sets < setsToWin && p2Sets < setsToWin) {
    const isFinal = p1Sets + p2Sets === bestOf - 1
    const set = simulateSet(p1HoldPct, p2HoldPct, isFinal)
    sets.push(set)
    totalGames += set.p1Games + set.p2Games

    if (set.winner === 1) p1Sets++
    else p2Sets++
  }

  return {
    winner: p1Sets > p2Sets ? 1 : 2,
    totalGames,
    sets,
  }
}

/**
 * Run full Monte Carlo simulation
 */
export function runSimulation(
  p1: Player,
  p2: Player,
  surface: string,
  bestOf: 3 | 5 = 3,
  iterations = DEFAULT_ITERATIONS
): SimulationResult {
  const p1Hold = p1.holdPct ?? 0.75
  const p2Hold = p2.holdPct ?? 0.75

  let p1Wins = 0
  const gamesCount: Record<number, number> = {}
  let spreadCovers = 0   // p1 wins by 2+ games net
  let over21 = 0

  for (let i = 0; i < iterations; i++) {
    const result = simulateMatch({ p1HoldPct: p1Hold, p2HoldPct: p2Hold, bestOf })

    if (result.winner === 1) p1Wins++
    gamesCount[result.totalGames] = (gamesCount[result.totalGames] || 0) + 1

    // Spread: p1 net games (total games won - total games lost)
    const p1TotalGames = result.sets.reduce((s, set) => s + set.p1Games, 0)
    const p2TotalGames = result.sets.reduce((s, set) => s + set.p2Games, 0)
    if (p1TotalGames - p2TotalGames >= 2) spreadCovers++

    if (result.totalGames > 21) over21++
  }

  // Build games distribution in buckets
  const distribution: Record<string, number> = {
    '≤18': 0, '19-21': 0, '22-24': 0, '25-27': 0, '28-30': 0, '30+': 0,
  }
  for (const [games, count] of Object.entries(gamesCount)) {
    const g = parseInt(games)
    const pct = count / iterations
    if (g <= 18) distribution['≤18'] += pct
    else if (g <= 21) distribution['19-21'] += pct
    else if (g <= 24) distribution['22-24'] += pct
    else if (g <= 27) distribution['25-27'] += pct
    else if (g <= 30) distribution['28-30'] += pct
    else distribution['30+'] += pct
  }

  const avgGames = Object.entries(gamesCount)
    .reduce((sum, [g, c]) => sum + parseInt(g) * c, 0) / iterations

  return {
    winProb1: p1Wins / iterations,
    winProb2: 1 - p1Wins / iterations,
    avgGames: Math.round(avgGames * 10) / 10,
    gamesDistribution: distribution,
    spreadCoverPct: spreadCovers / iterations,
    over21Pct: over21 / iterations,
    iterations,
  }
}
