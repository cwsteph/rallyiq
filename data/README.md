# /data — RallyIQ data directory

All data files live here. The Next.js app reads them at startup — no database queries for
match history or player ratings.

---

## Files

| File | Written by | Read by |
|------|-----------|---------|
| `ratings.json` | `npm run ratings:build` | DuckDB client, all API routes |
| `today.json` | `npm run fetch:today` | Match + dashboard routes |
| `today-manual.json` | You, manually | `fetch-today.ts` (overrides scraping) |

---

## Step 1: Player ratings

The CSVs are **committed to this repo** — do not download them. JeffSackmann/tennis_atp
and tennis_wta were deleted upstream in June 2026 and no maintained mirror exists,
so `data/*.csv` is the archive. Everything from 2026-05-18 onward comes from ESPN
via `data/results.ndjson`.

```bash
# Build ratings (~2 min for 3 years)
npm run ratings:build
```

No CSVs? Use demo data:
```bash
npm run ratings:seed    # writes demo ratings.json + today.json instantly
```

---

## Step 2: Today's matches

### Option A — API-Sports (recommended, free)

1. Sign up at https://api-sports.io (no credit card)
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   APISPORTS_KEY=your_key_here
   ```
4. Run:
   ```bash
   npm run fetch:today
   ```

Free tier: **100 requests/day** — more than enough for one daily fetch.
Covers ATP + WTA singles with surface, round, and scheduled times.

### Option B — Manual override

Create `data/today-manual.json` (copy from `today-manual.json.example`).
The scraper uses this file directly when it exists, without any network calls.

```bash
cp data/today-manual.json.example data/today-manual.json
# Edit with today's actual draw
```

### Option C — Carry-forward

If neither API-Sports nor manual override are set, the existing `today.json`
is kept as-is. The app still works — it just shows yesterday's schedule.

---

## How this data stays current

GitHub Actions (`.github/workflows/rebuild-ratings.yml`) runs daily at 07:00 UTC:

1. `scripts/espn/backfill.ts --apply` appends the last 10 days of completed
   main-draw singles to `data/results.ndjson`, deduped by ESPN competition id.
2. `scripts/build-ratings.mjs` rebuilds `data/ratings.json` from the committed
   CSVs plus that log.
3. `scripts/fetch-today.ts` rewrites `data/today.json`.

Any step producing nothing exits non-zero. The previous setup did the opposite:
`vercel.json` declared a cron that Netlify never executes, and the weekly
workflow swallowed upstream 404s and exited 0, so it reported success six times
in a row while processing zero matches.

### Known gaps, deliberate

- `hold_pct` and `break_pct` are frozen at 2026-05-17. ESPN returns
  `statistics: []`, and no free source replaces Sackmann's serve columns. They
  should be labelled with an as-of date in the UI and kept out of signal maths.
- `current_rank` is ESPN's live top 150 per tour, overlaid on the frozen CSV
  ranks beneath. Rank is display-only and never reaches `computeWinProbability`.
- Surface is resolved from the committed CSVs by tournament name, then venue
  city, with `data/surface-overrides.json` for the rest. A tournament that
  resolves to nothing is listed in `data/unmatched.json` and its matches are
  dropped — in practice that is Challenger and WTA 125 events, which the
  main-tour-only CSV base never contained.
- Qualifying rounds are excluded for the same reason. ESPN bundles them into the
  main-draw event: 112 of Wimbledon 2026's 239 completed men's singles
  competitions were qualifying.

### Manual via UI
The Refresh button in the top bar calls `POST /api/refresh` and reloads.

---

## CSV column reference (Sackmann format)

| Column | Description |
|--------|-------------|
| `tourney_date` | YYYYMMDD |
| `surface` | Hard / Clay / Grass / Carpet |
| `winner_id` | Sackmann player ID (used as player_id in ratings.json) |
| `loser_id` | Same |
| `w_bpFaced` | Winner break points faced |
| `w_bpSaved` | Winner break points saved |
| `best_of` | 3 or 5 |
| `round` | R128, R64, R32, R16, QF, SF, F |
