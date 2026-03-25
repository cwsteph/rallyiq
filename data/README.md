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

Download Sackmann CSVs then build ratings:

```bash
# Quick download (last 3 years)
git clone --depth=1 --filter=blob:none --sparse \
  https://github.com/JeffSackmann/tennis_atp.git /tmp/atp
cd /tmp/atp && git sparse-checkout set "atp_matches_202*.csv"
cp atp_matches_*.csv /path/to/rallyiq/data/

git clone --depth=1 --filter=blob:none --sparse \
  https://github.com/JeffSackmann/tennis_wta.git /tmp/wta
cd /tmp/wta && git sparse-checkout set "wta_matches_202*.csv"
cp wta_matches_*.csv /path/to/rallyiq/data/

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

## Automating the daily refresh

### Vercel cron (deployed app)
`vercel.json` already configures a daily run at 07:00 UTC:
```json
{ "crons": [{ "path": "/api/refresh", "schedule": "0 7 * * *" }] }
```

### Local cron
```bash
# Add to crontab (crontab -e)
0 7 * * * cd /path/to/rallyiq && npx tsx scripts/fetch-today.ts
```

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
