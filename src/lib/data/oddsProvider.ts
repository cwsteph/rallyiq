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

// ─── The Odds API sport keys for tennis ──────────────────────────────────────
// Only covers Grand Slams + ATP/WTA 1000s. Smaller events fall back to mock.
const ODDS_API_TENNIS_SPORTS = [
  'tennis_atp_aus_open',
  'tennis_atp_french_open',
  'tennis_atp_wimbledon',
  'tennis_atp_us_open',
  'tennis_atp_madrid_open',
  'tennis_atp_rome',
  'tennis_atp_monte_carlo',
  'tennis_atp_miami_open',
  'tennis_atp_indian_wells',
  'tennis_atp_canadian_open',
  'tennis_atp_cincinnati',
  'tennis_atp_shanghai',
  'tennis_atp_paris',
  'tennis_wta_aus_open',
  'tennis_wta_french_open',
  'tennis_wta_wimbledon',
  'tennis_wta_us_open',
  'tennis_wta_madrid',
  'tennis_wta_rome',
  'tennis_wta_miami_open',
  'tennis_wta_indian_wells',
  'tennis_wta_canadian_open',
  'tennis_wta_cincinnati',
  'tennis_wta_china_open',
]

// Slugify a player name for matching
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// Build a lookup key from two player names (order-independent)
function matchKey(p1: string, p2: string) {
  return [slugify(p1), slugify(p2)].sort().join('|')
}

/**
 * Fetch real odds from The Odds API for all in-season tennis tournaments.
 * Returns a map of matchKey -> { p1Odds, p2Odds, p1Name, p2Name }
 * Falls back gracefully if API key is missing or request fails.
 */
export async function fetchRealOdds(): Promise<Map<string, { p1Odds: number; p2Odds: number; p1Name: string; p2Name: string }>> {
  const apiKey = process.env.ODDS_API_KEY
  const map = new Map<string, { p1Odds: number; p2Odds: number; p1Name: string; p2Name: string }>()

  if (!apiKey) {
    console.log('[OddsAPI] No ODDS_API_KEY set, skipping real odds fetch')
    return map
  }

  for (const sport of ODDS_API_TENNIS_SPORTS) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us,uk&markets=h2h&oddsFormat=decimal`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })

      // 422 = tournament not in season, skip silently
      if (res.status === 422 || res.status === 404) continue
      if (!res.ok) {
        console.warn(`[OddsAPI] ${sport} returned ${res.status}`)
        continue
      }

      const events: any[] = await res.json()
      for (const event of events) {
        const outcomes = event.bookmakers?.[0]?.markets?.[0]?.outcomes
        if (!outcomes || outcomes.length < 2) continue

        const p1Name = outcomes[0].name
        const p2Name = outcomes[1].name
        const p1Odds = outcomes[0].price
        const p2Odds = outcomes[1].price

        if (!p1Name || !p2Name || !p1Odds || !p2Odds) continue

        const key = matchKey(p1Name, p2Name)
        // Store both orderings so lookup works regardless of ESPN player order
        map.set(key, { p1Odds, p2Odds, p1Name, p2Name })
      }

      console.log(`[OddsAPI] ${sport}: ${events.length} matches`)
    } catch (e: any) {
      // Timeout or network error — skip this sport
      console.warn(`[OddsAPI] ${sport} failed: ${e.message}`)
    }
  }

  console.log(`[OddsAPI] Total real odds loaded: ${map.size} matches`)
  return map
}

/**
 * Look up real odds for a match by player names.
 * Returns odds in the correct order for (player1, player2).
 */
export function lookupRealOdds(
  oddsMap: Map<string, { p1Odds: number; p2Odds: number; p1Name: string; p2Name: string }>,
  player1Name: string,
  player2Name: string
): { odds1: number; odds2: number } | null {
  const key = matchKey(player1Name, player2Name)
  const entry = oddsMap.get(key)
  if (!entry) return null

  // Figure out which side is player1
  const p1Slug = slugify(player1Name)
  const entryP1Slug = slugify(entry.p1Name)

  if (p1Slug === entryP1Slug) {
    return { odds1: entry.p1Odds, odds2: entry.p2Odds }
  } else {
    // Swapped — return in correct order
    return { odds1: entry.p2Odds, odds2: entry.p1Odds }
  }
}

/**
 * Mock odds provider - fallback when real odds aren't available.
 * Used for smaller tournaments not covered by The Odds API.
 */
export class MockOddsProvider implements OddsProvider {
  private vigPct = 0.07

  generateOdds(trueProb1: number): { odds1: number; odds2: number } {
    // Market noise ±6% — simulates market disagreeing with model in both directions
    const noise = (Math.random() - 0.5) * 0.12
    const marketProb1 = Math.max(0.05, Math.min(0.95, trueProb1 + noise))
    const marketProb2 = 1 - marketProb1

    const viggedProb1 = marketProb1 * (1 + this.vigPct)
    const viggedProb2 = marketProb2 * (1 + this.vigPct)

    return {
      odds1: Math.round((1 / viggedProb1) * 100) / 100,
      odds2: Math.round((1 / viggedProb2) * 100) / 100,
    }
  }

  async getOddsForMatch(matchId: string): Promise<OddsLine | null> { return null }
  async getOddsForDate(date: Date): Promise<OddsLine[]> { return [] }
}

/**
 * Tennis-Data CSV odds provider
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

export const oddsProvider = new MockOddsProvider()