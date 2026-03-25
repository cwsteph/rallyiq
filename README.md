# RallyIQ — Tennis Betting Terminal

A professional tennis betting analysis platform. Ranks players, estimates win probabilities using a transparent Elo + stats model, compares to market odds, identifies edges, and tracks bankroll performance.

---

## Stack

- **Next.js 14** (App Router, Server Components)
- **TypeScript**
- **Tailwind CSS** (terminal dark theme)
- **Prisma + PostgreSQL**
- **Recharts** (bankroll charts)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/yourname/rallyiq
cd rallyiq
npm install
```

### 2. Set up the database

```bash
# Copy env template
cp .env.example .env.local

# Edit DATABASE_URL in .env.local
# Local Postgres example:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/rallyiq"
```

Options for Postgres:
- **Local**: Install PostgreSQL, create `rallyiq` database
- **Supabase** (free tier): https://supabase.com → New project → copy connection string
- **Railway** (free tier): https://railway.app → New PostgreSQL

```bash
# Push schema to database
npm run db:push

# Seed with demo data (30 players, 20 matches, bets)
npm run db:seed
```

### 3. Run the app

```bash
npm run dev
# Open http://localhost:3000
```

---

## Loading Real Data (Jeff Sackmann CSVs)

1. Download ATP/WTA match CSVs from https://github.com/JeffSackmann/tennis_atp and https://github.com/JeffSackmann/tennis_wta

2. Place CSV files in `/data/`:
```
data/
  atp_matches_2023.csv
  atp_matches_2024.csv
  wta_matches_2023.csv
  wta_matches_2024.csv
  atp_rankings_current.csv   (optional)
  wta_rankings_current.csv   (optional)
```

3. Run ingestion:
```bash
npm run ingest
```

This will:
- Parse all match rows
- Build Elo ratings from match history (surface-specific)
- Compute hold%, break%, recent form for every player
- Store everything in PostgreSQL

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── matches/
│   │   ├── page.tsx          # Match list
│   │   └── [id]/page.tsx     # Match detail + analysis
│   ├── rankings/page.tsx     # Player rankings table
│   ├── bankroll/page.tsx     # Bankroll tracker + charts
│   ├── backtest/page.tsx     # Historical performance
│   └── api/
│       ├── matches/route.ts  # GET matches with model outputs
│       ├── players/route.ts  # GET players + rankings
│       ├── bets/route.ts     # GET/POST bets
│       └── simulate/route.ts # POST run simulation
│
├── lib/
│   ├── model/
│   │   ├── elo.ts            # Elo rating system
│   │   ├── form.ts           # Form score + hold/break stats
│   │   └── probability.ts    # Core win probability model
│   ├── sim/
│   │   └── matchSimulation.ts # 10k Monte Carlo match sim
│   ├── betting/
│   │   ├── edge.ts           # Edge detection + Kelly criterion
│   │   └── bankroll.ts       # Bankroll tracking + stats
│   └── data/
│       ├── csvLoader.ts      # Sackmann CSV parser
│       └── oddsProvider.ts   # Pluggable odds interface
│
└── types/index.ts            # Shared TypeScript types

prisma/
└── schema.prisma             # Full DB schema

scripts/
├── ingest.ts                 # CSV → database ingestion
└── seed.ts                   # Demo data seeder

data/                         # Place Sackmann CSVs here
```

---

## Model

The probability model is **transparent and interpretable** — no ML black box.

### Step 1: Elo System
- Base Elo: 1500
- K-factor: 32 (40 for first 30 matches)
- Separate ratings: Overall, Hard, Clay, Grass
- Updated after every ingested match

### Step 2: Player Stats
From match history:
- **Hold %** — service games held
- **Break %** — return games converted
- **Form (last 10)** — weighted decay (85% per match)

### Step 3: Matchup Strength Score

```
strength =
  0.35 × surface_elo_diff / 200
+ 0.20 × overall_elo_diff / 200
+ 0.20 × form_diff
+ 0.15 × serve_return_diff
+ 0.10 × fatigue_diff
```

### Step 4: Win Probability

```
P = 1 / (1 + exp(-0.6 × strength))
```

### Step 5: Edge Detection

```
edge = model_prob - market_implied_prob
```

- `edge ≥ 5%` → **BET**
- `edge 2–5%` → **LEAN**
- `edge < 2%` → **PASS**

### Step 6: Kelly Criterion

```
f = (p × b - q) / b
stake = bankroll × f × 0.25   # fractional Kelly
stake = min(stake, bankroll × 2%)
```

---

## Simulation Engine

`/lib/sim/matchSimulation.ts` runs 10,000 match simulations:

- Simulates service games using hold% per player
- Handles tiebreaks and best-of-3 / best-of-5 formats
- Outputs: win probability, total games distribution, spread cover %

---

## Odds Provider

The `OddsProvider` interface in `/lib/data/oddsProvider.ts` is designed for future API upgrades:

```typescript
interface OddsProvider {
  getOddsForMatch(matchId: string): Promise<OddsLine | null>
  getOddsForDate(date: Date): Promise<OddsLine[]>
}
```

Currently ships with:
- `MockOddsProvider` — generates plausible odds from model probability + market noise
- `TennisDataOddsProvider` — loads from Tennis-Data.co.uk historical CSV files

To plug in a real odds API:
```typescript
class TheOddsApiProvider implements OddsProvider {
  async getOddsForMatch(matchId: string) {
    // call https://api.the-odds-api.com/...
  }
}
```

---

## Bankroll Rules

- Starting bankroll: **$100**
- Default bet size: **1% of bankroll**
- Maximum bet: **2% of bankroll**
- Kelly fraction: **25%** (conservative)
- Bet only if: edge ≥ 2% AND model confidence ≥ 52%

---

## Database Commands

```bash
npm run db:push      # Sync schema to DB (no migrations)
npm run db:migrate   # Create migration file + apply
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed demo data
npm run ingest       # Load Sackmann CSVs from /data/
```

---

## Phase Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| 1 | ✅ | UI scaffold, CSV ingestion, rankings, dashboard |
| 2 | ✅ | Elo model, probability engine, edge detection |
| 3 | ✅ | Monte Carlo simulation, totals, spread |
| 4 | ✅ | Bankroll tracker, backtest, CLV |
| 5 | Planned | Live scraping (Tennis Abstract), real odds API |
| 6 | Planned | ML model layer (XGBoost/logistic regression) |
| 7 | Planned | Alerts, Telegram bot, automated bet logging |

---

## Free Data Sources

| Source | Used For | URL |
|--------|----------|-----|
| Jeff Sackmann ATP | Match history, Elo building | github.com/JeffSackmann/tennis_atp |
| Jeff Sackmann WTA | WTA match history | github.com/JeffSackmann/tennis_wta |
| Tennis-Data.co.uk | Historical odds (CSV) | tennis-data.co.uk |
| Tennis Abstract | Live Elo, surface splits | tennisabstract.com |

---

Built with the philosophy: **transparent model, real edge, no black boxes.**
# rallyiq
