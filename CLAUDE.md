# RallyIQ

Next.js tennis (ATP + WTA) betting terminal. Deploys to Netlify at rallyiq-app.netlify.app.

## Commands

```bash
npm run dev                  # local dev
npm run build                # production build — run before claiming a feature done
npm test                     # node --test over scripts/espn/*.test.ts
npm run ratings:build        # rebuild data/ratings.json from csvs + espn log
npm run fetch:today          # rewrite data/today.json from ESPN
npm run espn:backfill        # dry run: what the log would gain
npm run espn:backfill:apply  # append to data/results.ndjson
```

## Data pipeline

- **ESPN is the sole upstream.** `site.api.espn.com` is public but undocumented and
  unversioned — assert structure, fail loudly, never parse optimistically.
- **`?dates=YYYYMMDD` returns whole tournaments, not one day.** Wimbledon comes back
  as 635 competitions spanning 18 days. Always dedupe on competition id.
- **ESPN publishes no surface.** `"court"` is a court name ("Centre Court"). Surface
  resolves from the committed CSVs via `scripts/espn/surface.ts`; unknown means null,
  and null never becomes "Hard". Note `build-ratings.mjs` still defaults a missing
  surface to Hard internally — `toCsvRows` drops null-surface rows before it can.
- **ESPN bundles qualifying into the main-draw event.** Filtered out: the CSV base is
  main-tour only, so ingesting qualifying would feed Elo a category its history has
  never contained.
- **Tour comes from the grouping slug, never the endpoint.** The ATP scoreboard
  returns women's events too.
- **ESPN 403s `https.get` on the scoreboard** whatever User-Agent you send, and 200s
  the same URL through `fetch()`. Use `fetch`.
- `data/*.csv` is committed on purpose. Do not re-add it to `.gitignore`.
- `data/results.ndjson` is append-only and owned outright. It is the reason a
  third party cannot delete this pipeline again.

## Identity

- `player_id` **never changes** for the 1,575 pre-ESPN players. `Bet.playerExternalId`
  and `matchExternalId` are loose strings with no foreign key, so reassigning ids
  orphans live bets silently.
- ESPN ids and Sackmann ids are different id spaces. `scripts/espn/identity.ts` is the
  only place fuzzy name matching happens; everything downstream joins on the mapped
  `player_id`. Feeding raw ESPN ids to the builder enters each player twice and halves
  their Elo.
- Matching is three tiers — exact, reordered tokens (ESPN writes Chinese names
  surname-first), token-subset (dropped middle surnames) — each requiring exactly one
  candidate. Ambiguity stays unmatched and lands in `data/unmatched-players.json`.
  Never match on a bare surname, and never fall back to a slug.
- **`player_id` is not unique in `ratings.json`.** Sackmann's ATP and WTA id spaces
  overlap: 5 ids are shared across tours (211768 is both Naomi Osaka and Manas Dhamne).
  Key on `tour:player_id`. A continuity test pins the count at 5.

## Testing

- Node 22 type stripping runs `.ts` directly. Every relative import needs an explicit
  `.ts` extension; `node --test` needs file globs, not directories.
- No test hits the network — ESPN responses are committed fixtures.
- The Elo continuity test rebuilds `--base-only` into a scratch file and asserts zero
  drift against `data/ratings.baseline.json`. If it fails, the builder has diverged
  from the one that produced the live ratings and nothing it emits can be trusted.

## Writing style

Conventional-commit prefixes (`feat:`, `fix:`, `refactor:`), lowercase. Concrete
numbers in bullets. For a non-obvious bug, explain the mechanism, not the symptom.
