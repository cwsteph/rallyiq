// src/lib/data/oddsProvider.ts
// Designed so a real API (The Odds API, BetFair, etc.) can be plugged in later
// by implementing the OddsProvider interface.

export interface OddsLine {
  matchId: string
  player1Odds: number  // decimal
  player2Odds: number
  bookmaker: string
  timestamp: Date
}

export interface OddsProvider {
  getOddsForMatch(matchId: string): Promise<OddsLine | null>
  getOddsForDate(date: Date): Promise<OddsLine[]>
}

/**
 * Mock odds provider - generates plausible odds from model probabilities
 * Simulates a real bookmaker with proper vig and market noise.
 * Replace with real API implementation when ready.
 */
export class MockOddsProvider implements OddsProvider {
  // Typical bookmaker vig: 6-8% for tennis moneyline
  private vigPct = 0.07

  generateOdds(trueProb1: number): { odds1: number; odds2: number } {
    const trueProb2 = 1 - trueProb1

    // Add realistic market noise ±2% — bookmakers aren't perfectly efficient
    // but they're close, so noise is smaller than the vig
    const noise = (Math.random() - 0.5) * 0.04
    const marketProb1 = Math.max(0.05, Math.min(0.95, trueProb1 + noise))
    const marketProb2 = 1 - marketProb1

    // Apply full vig to both sides — this is what creates the overround
    // A real book at 7% vig means implied probs sum to ~107%
    const viggedProb1 = marketProb1 * (1 + this.vigPct)
    const viggedProb2 = marketProb2 * (1 + this.vigPct)

    // Convert to decimal odds and round to 2 decimal places
    return {
      odds1: Math.round((1 / viggedProb1) * 100) / 100,
      odds2: Math.round((1 / viggedProb2) * 100) / 100,
    }
  }

  async getOddsForMatch(matchId: string): Promise<OddsLine | null> {
    return null
  }

  async getOddsForDate(date: Date): Promise<OddsLine[]> {
    return []
  }
}

/**
 * Tennis-Data CSV odds provider
 * Load from historical Tennis-Data.co.uk CSVs
 * Columns: B365W, B365L (Bet365 winner/loser odds)
 */
export class TennisDataOddsProvider implements OddsProvider {
  private oddsMap: Map<string, OddsLine> = new Map()

  loadFromCSV(rows: Record<string, string>[]): void {
    for (const row of rows) {
      const matchKey = `${row.Tournament}_${row.Winner}_${row.Loser}_${row.Date}`
      const odds1 = parseFloat(row.B365W || row.CBW || '0')
      const odds2 = parseFloat(row.B365L || row.CBL || '0')
      if (odds1 > 0 && odds2 > 0) {
        this.oddsMap.set(matchKey, {
          matchId: matchKey,
          player1Odds: odds1,
          player2Odds: odds2,
          bookmaker: 'Bet365',
          timestamp: new Date(row.Date || ''),
        })
      }
    }
  }

  async getOddsForMatch(matchId: string): Promise<OddsLine | null> {
    return this.oddsMap.get(matchId) || null
  }

  async getOddsForDate(date: Date): Promise<OddsLine[]> {
    const dateStr = date.toISOString().slice(0, 10)
    return Array.from(this.oddsMap.values()).filter(
      o => o.timestamp.toISOString().slice(0, 10) === dateStr
    )
  }
}

// Future: plug in real provider here
// export class TheOddsApiProvider implements OddsProvider { ... }
// export class BetFairProvider implements OddsProvider { ... }
export const oddsProvider = new MockOddsProvider()