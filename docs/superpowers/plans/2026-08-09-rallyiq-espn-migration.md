# RallyIQ ESPN Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deleted Sackmann feed with ESPN as RallyIQ's sole upstream, close the 2026-05-18 → today match gap (~1,772 matches including Roland Garros and Wimbledon), and make the match log something no third party can delete.

**Architecture:** The committed CSVs (2022 → 2026-05-17) become a frozen historical base. A new `scripts/espn/` module fetches ESPN tournaments, filters to completed singles matches, and appends them to `data/results.ndjson`, deduped by ESPN competition id. `build-ratings.mjs` is repointed from Sackmann URLs to base-CSVs-plus-log and otherwise keeps its Elo math unchanged. Pure parsing/matching logic lives in small tested modules; only two files touch the network.

**Tech Stack:** TypeScript, Node 22 (`node --test` with native type stripping), ESPN's public `site.api.espn.com` endpoints, existing `build-ratings.mjs` (plain ESM JavaScript).

## Global Constraints

- Node on this machine is **v22.22.2**. Type stripping is unflagged, so `node --test "scripts/espn/*.test.ts"` runs TypeScript directly. Do **not** add vitest, jest, or ts-node. `tsx` already exists as a devDependency and stays for `fetch-today.ts` only.
- **Every relative import must carry an explicit `.ts` extension** — `import { resolveSurface } from "./surface.ts"`. Node's ESM resolver does not do extensionless resolution and type stripping does not change that.
- **`node --test` must be given file globs, not directories.**
- **`scripts/espn` must be added to `tsconfig.json`'s `exclude` array.** Next's typecheck rejects the `.ts` import extensions Node requires. This exact conflict broke the PaddockIQ build on 2026-08-09; the exclude is what lets both hold.
- **No test may make a network call.** Every ESPN interaction in tests goes through a committed fixture.
- `build-ratings.mjs` is **plain `.mjs` JavaScript, not TypeScript.** Do not convert it. It imports from the new modules only via their compiled-free `.ts` paths under Node type stripping, which works because Node strips types at load for `.ts` too — verify this in Task 7 before relying on it.
- **`player_id` never changes for the existing 1,575 players.** `Bet.playerExternalId` and `matchExternalId` are loose strings with no foreign key; reassigning ids orphans existing bets silently.
- Commit messages use lowercase conventional-commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
- Never write a data file when the fetch produced zero records. Validate, then write, then commit.

## Known State (verified 2026-08-09)

- `data/ratings.json` — 1,575 players (821 ATP / 754 WTA), last written 2026-06-02. Shape per player: `{player_id, name, tour, elo_overall, elo_hard, elo_clay, elo_grass, hold_pct, break_pct, form_score, form_json, current_rank, current_rank_points, matches_played}`.
- `data/today.json` — 12 matches, frozen 2026-03-26. Shape: `{match_id: "espn_173256", tournament, surface, round, best_of, match_date, scheduled_time, player1_id, player1_name, player2_id, player2_name, source: "espn-atp"}`.
- The 12 CSVs are committed as of 2026-08-09 (`chore: commit the Sackmann CSVs, drop the vercel cron that never ran`). ATP matches end 2026-05-17, WTA 2026-05-18.
- `build-ratings.mjs` (267 lines) consumes exactly these CSV columns: `tourney_date, surface, winner_id, winner_name, loser_id, loser_name, score, round, w_svpt, w_1stWon, w_2ndWon, l_svpt`. Elo config: `ELO_START 1500`, `K_BASE 32`, `K_SURFACE 24`, `ROOKIE_BONUS 8`, `SURFACE_MAP {Hard: elo_hard, Clay: elo_clay, Grass: elo_grass, Carpet: elo_hard}`.
- `vercel.json`'s dead cron block is already deleted.
- `.github/workflows/rebuild-ratings.yml` still points at the deleted Sackmann repos and still exits 0 on 404.

### ESPN API facts — verified against live responses, and where the design spec was wrong

- **`?dates=YYYYMMDD` returns whole tournaments, not one day.** `dates=20260706` returned Wimbledon with **635 competitions spanning 2026-06-22 → 07-12**. One request per tournament-week gets the full draw, and dedupe by competition id is mandatory rather than a nicety.
- **`competitor.id` is present directly** (e.g. `"13489"`) and equals the playercard id. The spec claimed ESPN omits it and that a `/player/_/id/(\d+)/` regex on the playercard href was required. Use `competitor.id` first and keep the regex only as a fallback.
- **ESPN carries no surface field.** The spec's source table claims "Event + surface: yes" — it does not. `"court"` is a court *name* ("Centre Court"). Surface must be resolved from the committed CSVs; Task 1 exists solely for this.
- **Tournament names do not join to Sackmann.** ESPN uses sponsor names ("BNP Paribas Open", "National Bank Open presented by Rogers"), Sackmann uses cities ("Indian Wells", "Canada Masters"). Direct name join resolved **2 of 21** sampled events. Adding a `venue.displayName` city fallback took it to **17 of 21**; the 4 remaining are 125-level events (Antalya, Contrexeville) that the builder never rated, since it only ever downloaded main-tour files.
- `athlete.id` on the rankings endpoint is the same id space — Sinner is `3623` in both. Rankings are hard-capped at 150 per tour.
- Events carry `groupings[].grouping.slug` of `mens-singles`, `womens-singles`, `mens-doubles`, `womens-doubles`, `mixed-doubles`. Only the two singles slugs are in scope.
- **ESPN bundles qualifying into the main-draw event** — found during execution, 2026-08-09. Wimbledon's `mens-singles` grouping holds 239 completed competitions, of which **112 are qualifying** (64 Q1 + 32 Q2 + 16 QF). The committed CSVs are main-tour only; Sackmann keeps qualifying in `qual_chall` files the builder never downloaded. Ingesting it would feed Elo a match category its history has never contained and inflate `matches_played` for exactly the low-ranked players whose ratings are already thinnest. Filtered on `/qualif/i` against `round.displayName`.
- `round` is **not** read by `build-ratings.mjs` — the apparent hits in an earlier grep were all `Math.round`. It is carried in the log for provenance only, so no ESPN→Sackmann round-code mapping is needed.
- Doubles competitors have no `athlete` object at all (they are teams), so a name check is a second line of defence behind the slug filter.
- A completed competition has `status.type.completed === true`, `competitors[].winner` true/false, `competitors[].linescores[].value` per set, and a `notes[0].text` summary like `"Zsombor Piros (HUN) bt Ivan Ivanov (BUL) 6-2 6-2"`.
- One tour's scoreboard can return the other tour's groupings (the ATP endpoint returned `womens-singles` for Nordea Open). Dedupe across tours by competition id.

## File Structure

**Create:**
- `scripts/espn/types.ts` — `MatchRecord`, `EspnCompetitor`, `RankingEntry`, `FetchFn`
- `scripts/espn/surface.ts` — tournament → surface, built from the committed CSVs plus an override table
- `scripts/espn/surface.test.ts`
- `scripts/espn/parse.ts` — ESPN scoreboard JSON → `MatchRecord[]` (pure)
- `scripts/espn/parse.test.ts`
- `scripts/espn/rankings.ts` — rankings JSON → `RankingEntry[]` (pure) + fetch
- `scripts/espn/rankings.test.ts`
- `scripts/espn/log.ts` — read/append `data/results.ndjson`, deduped by competition id
- `scripts/espn/log.test.ts`
- `scripts/espn/identity.ts` — `espn_id` ↔ `player_id` map, the only fuzzy name matching in the system
- `scripts/espn/identity.test.ts`
- `scripts/espn/backfill.ts` — CLI: walk 2026-05-18 → today, append to the log (I/O)
- `scripts/espn/__fixtures__/scoreboard-wimbledon-2026.json` — trimmed real response
- `scripts/espn/__fixtures__/scoreboard-empty.json`
- `scripts/espn/__fixtures__/rankings-atp.json`
- `data/surface-overrides.json` — hand-maintained tournament → surface for events absent from the CSVs
- `data/results.ndjson` — the accumulating match log (created by Task 6)
- `data/unmatched.json` — names and tournaments that failed to resolve

**Modify:**
- `package.json` — test + backfill scripts
- `tsconfig.json` — exclude `scripts/espn`
- `scripts/build-ratings.mjs` — read local CSVs + `results.ndjson` instead of Sackmann URLs
- `scripts/fetch-today.ts:88` — stop silently slugifying unresolved names
- `.github/workflows/rebuild-ratings.yml` — run the backfill, fail on empty

---

### Task 1: Surface resolution

**Files:**
- Create: `scripts/espn/surface.ts`
- Create: `data/surface-overrides.json`
- Test: `scripts/espn/surface.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `normalizeName(s: string): string` — lowercase, strip accents, strip non-alphanumerics
  - `buildSurfaceMap(csvDir: string, overrides: Record<string, string>): Map<string, string>`
  - `resolveSurface(map: Map<string,string>, eventName: string, venue: string): string | null`

ESPN publishes no surface. The committed CSVs contain 680 distinct `tourney_name` → `surface` pairs, so the map is derived from data already in the repo, with `venue.displayName`'s city as the fallback key and a hand-maintained override file for the rest. Unknown surface returns `null` and the caller logs it — never a default of `"Hard"`, which would silently corrupt clay and grass Elo.

- [ ] **Step 1: Create the override file**

Create `data/surface-overrides.json`. These are the sampled events that resolved by neither name nor city, with surfaces verified from the 2026 calendar:

```json
{
  "montecarlomasters": "Clay",
  "rolexmontecarlomasters": "Clay",
  "tropheeclarins": "Clay",
  "grandestopen88": "Clay",
  "megasarayhotelsopen3": "Clay"
}
```

- [ ] **Step 2: Write the failing test**

Create `scripts/espn/surface.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, buildSurfaceMap, resolveSurface } from "./surface.ts";

test("normalizeName strips case, accents and punctuation", () => {
  assert.equal(normalizeName("Trophée Clarins"), "tropheeclarins");
  assert.equal(normalizeName("Monte-Carlo Masters"), "montecarlomasters");
  assert.equal(normalizeName("s-Hertogenbosch"), "shertogenbosch");
});

test("buildSurfaceMap reads every committed CSV", () => {
  const map = buildSurfaceMap("data", {});
  assert.ok(map.size > 500, `expected 500+ tournaments, got ${map.size}`);
  assert.equal(map.get("wimbledon"), "Grass");
  assert.equal(map.get("rolandgarros"), "Clay");
  assert.equal(map.get("indianwells"), "Hard");
});

test("overrides win over CSV entries", () => {
  const map = buildSurfaceMap("data", { wimbledon: "Carpet" });
  assert.equal(map.get("wimbledon"), "Carpet");
});

test("resolveSurface matches on the event name", () => {
  const map = new Map([["wimbledon", "Grass"]]);
  assert.equal(resolveSurface(map, "Wimbledon", "London, Great Britain"), "Grass");
});

test("resolveSurface falls back to the venue city", () => {
  const map = new Map([["bastad", "Clay"]]);
  assert.equal(resolveSurface(map, "Nordea Open", "Båstad, Sweden"), "Clay");
});

test("resolveSurface returns null rather than guessing", () => {
  const map = new Map([["wimbledon", "Grass"]]);
  assert.equal(resolveSurface(map, "Some 125 Event", "Contrexeville, France"), null);
});

test("resolveSurface tolerates a missing venue", () => {
  const map = new Map([["wimbledon", "Grass"]]);
  assert.equal(resolveSurface(map, "Wimbledon", ""), "Grass");
  assert.equal(resolveSurface(map, "Unknown", ""), null);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/espn/surface.test.ts`
Expected: FAIL — `Cannot find module './surface.ts'`

- [ ] **Step 4: Write the implementation**

Create `scripts/espn/surface.ts`:

```typescript
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** Canonical key for comparing tournament and city names across sources. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * tourney_name -> surface, read from the committed Sackmann CSVs. These are
 * frozen at 2026-05-17 but surfaces do not change, so the map stays valid for
 * events that have run before. `overrides` covers everything else.
 */
export function buildSurfaceMap(
  csvDir: string,
  overrides: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const file of readdirSync(csvDir).filter((f) => /^(atp|wta)_matches_\d{4}\.csv$/.test(f))) {
    const lines = readFileSync(path.join(csvDir, file), "utf8").split("\n");
    const header = lines[0].split(",");
    const nameIdx = header.indexOf("tourney_name");
    const surfaceIdx = header.indexOf("surface");
    if (nameIdx === -1 || surfaceIdx === -1) continue;

    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const name = cols[nameIdx];
      const surface = cols[surfaceIdx];
      if (name && surface) map.set(normalizeName(name), surface);
    }
  }

  for (const [k, v] of Object.entries(overrides)) map.set(normalizeName(k), v);
  return map;
}

/**
 * ESPN event name first, then the venue's city. Returns null when neither
 * resolves — the caller records it in unmatched.json. Never guess a surface:
 * a wrong surface silently corrupts that surface's Elo for every player in the
 * draw.
 */
export function resolveSurface(
  map: Map<string, string>,
  eventName: string,
  venue: string,
): string | null {
  const byName = map.get(normalizeName(eventName));
  if (byName) return byName;

  const city = venue.split(",")[0] ?? "";
  if (!city) return null;
  return map.get(normalizeName(city)) ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test scripts/espn/surface.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 6: Add the test script and the tsconfig exclude**

In `package.json` `"scripts"`:

```json
"test": "node --test \"scripts/espn/*.test.ts\""
```

In `tsconfig.json`, change the `exclude` line to:

```json
"exclude": ["node_modules", "scripts/espn"]
```

- [ ] **Step 7: Confirm the build still passes**

Run: `npm test && npm run build`
Expected: 7 tests pass, Next build succeeds. If the build fails with "An import path can only end with a '.ts' extension", the tsconfig exclude did not take.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json data/surface-overrides.json scripts/espn/surface.ts scripts/espn/surface.test.ts
git commit -m "feat: resolve tournament surface from the committed csvs"
```

---

### Task 2: Scoreboard parsing

**Files:**
- Create: `scripts/espn/types.ts`
- Create: `scripts/espn/parse.ts`
- Test: `scripts/espn/parse.test.ts`
- Create: `scripts/espn/__fixtures__/scoreboard-wimbledon-2026.json`
- Create: `scripts/espn/__fixtures__/scoreboard-empty.json`

**Interfaces:**
- Consumes: `resolveSurface` from `./surface.ts`
- Produces:
  - `interface MatchRecord { competition_id: string; date: string; tournament: string; surface: string | null; round: string; best_of: number; tour: "ATP" | "WTA"; winner_espn_id: string; winner_name: string; loser_espn_id: string; loser_name: string; score: string }`
  - `parseScoreboard(json: unknown, surfaceMap: Map<string,string>): { matches: MatchRecord[]; unknownSurfaces: string[] }`
  - `competitorId(c: unknown): string | null`

- [ ] **Step 1: Capture and trim the fixture**

The full Wimbledon response is 1.8 MB. Trim it to the first two singles competitions plus one doubles competition, so the test proves doubles are excluded:

```bash
mkdir -p scripts/espn/__fixtures__
curl -s "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20260706" \
  | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const j=JSON.parse(s);
  const ev=j.events.find(e=>e.name==='Wimbledon');
  const keep=(slug,n)=>{
    const g=ev.groupings.find(g=>g.grouping.slug===slug);
    return {...g, competitions:g.competitions.filter(c=>c.status?.type?.completed).slice(0,n)};
  };
  ev.groupings=[keep('mens-singles',2), keep('mens-doubles',1)];
  process.stdout.write(JSON.stringify({events:[ev]},null,1));
})" > scripts/espn/__fixtures__/scoreboard-wimbledon-2026.json

printf '{ "events": [] }\n' > scripts/espn/__fixtures__/scoreboard-empty.json
```

Open the fixture and confirm it contains two `mens-singles` competitions with `"completed": true` and one `mens-doubles` competition. If `events` is empty, ESPN changed the endpoint and the plan's premise needs revisiting before continuing.

- [ ] **Step 2: Write the failing test**

Create `scripts/espn/parse.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseScoreboard, competitorId } from "./parse.ts";

const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${n}.json`, import.meta.url), "utf8"));

const SURFACES = new Map([["wimbledon", "Grass"]]);

test("competitorId prefers the direct id", () => {
  assert.equal(competitorId({ id: "13489", athlete: { links: [] } }), "13489");
});

test("competitorId falls back to the playercard link", () => {
  const c = {
    athlete: { links: [{ rel: ["playercard"], href: "https://www.espn.com/tennis/player/_/id/13489/ivan-ivanov" }] },
  };
  assert.equal(competitorId(c), "13489");
});

test("competitorId returns null when neither is present", () => {
  assert.equal(competitorId({ athlete: { links: [] } }), null);
  assert.equal(competitorId(null), null);
});

test("parses completed singles matches", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  assert.equal(matches.length, 2, "expected exactly the two singles competitions");
  for (const m of matches) {
    assert.equal(m.tournament, "Wimbledon");
    assert.equal(m.surface, "Grass");
    assert.ok(m.winner_espn_id, "winner needs an espn id");
    assert.ok(m.loser_espn_id, "loser needs an espn id");
    assert.notEqual(m.winner_espn_id, m.loser_espn_id);
    assert.match(m.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("excludes doubles", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  const ids = matches.map((m) => m.competition_id);
  assert.equal(new Set(ids).size, ids.length, "competition ids must be unique");
  assert.equal(matches.length, 2);
});

test("best_of is 5 for a men's slam and the score is a string", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  assert.equal(matches[0].best_of, 5);
  assert.equal(typeof matches[0].score, "string");
  assert.ok(matches[0].score.length > 0);
});

test("an unknown surface yields null and is reported, not defaulted", () => {
  const { matches, unknownSurfaces } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), new Map());
  assert.equal(matches[0].surface, null);
  assert.deepEqual(unknownSurfaces, ["Wimbledon"]);
});

test("returns nothing for an empty scoreboard", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-empty"), SURFACES);
  assert.deepEqual(matches, []);
});

test("returns nothing for malformed input", () => {
  assert.deepEqual(parseScoreboard(null, SURFACES).matches, []);
  assert.deepEqual(parseScoreboard({}, SURFACES).matches, []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/espn/parse.test.ts`
Expected: FAIL — `Cannot find module './parse.ts'`

- [ ] **Step 4: Write the types**

Create `scripts/espn/types.ts`:

```typescript
export interface MatchRecord {
  competition_id: string;
  date: string;
  tournament: string;
  surface: string | null;
  round: string;
  best_of: number;
  tour: "ATP" | "WTA";
  winner_espn_id: string;
  winner_name: string;
  loser_espn_id: string;
  loser_name: string;
  score: string;
}

export interface RankingEntry {
  espn_id: string;
  name: string;
  rank: number;
  points: number;
  tour: "ATP" | "WTA";
}

export type FetchFn = (url: string) => Promise<unknown | null>;
```

- [ ] **Step 5: Write the implementation**

Create `scripts/espn/parse.ts`:

```typescript
import { resolveSurface } from "./surface.ts";
import type { MatchRecord } from "./types.ts";

const SINGLES = new Set(["mens-singles", "womens-singles"]);

/** ESPN gives competitor.id directly; the playercard href is the fallback. */
export function competitorId(c: unknown): string | null {
  if (!c || typeof c !== "object") return null;
  const comp = c as Record<string, any>;
  if (comp.id) return String(comp.id);

  const href = (comp.athlete?.links || []).find((l: any) => l.rel?.includes("playercard"))?.href;
  const m = typeof href === "string" ? href.match(/\/player\/_\/id\/(\d+)/) : null;
  return m ? m[1] : null;
}

/** Set scores as "6-2 6-2", taken from the two competitors' linescores. */
function scoreOf(winner: any, loser: any): string {
  const w = winner.linescores || [];
  const l = loser.linescores || [];
  const sets: string[] = [];
  for (let i = 0; i < Math.max(w.length, l.length); i++) {
    const a = w[i]?.value;
    const b = l[i]?.value;
    if (a == null || b == null) continue;
    sets.push(`${a}-${b}`);
  }
  return sets.join(" ");
}

/**
 * Pure: an ESPN scoreboard payload in, completed singles matches out.
 *
 * `?dates=` returns entire tournaments rather than a single day, so a caller
 * fetching a date range will see the same competition many times. Dedupe on
 * competition_id downstream — this function reports what one payload holds.
 */
export function parseScoreboard(
  json: unknown,
  surfaceMap: Map<string, string>,
): { matches: MatchRecord[]; unknownSurfaces: string[] } {
  const matches: MatchRecord[] = [];
  const unknown = new Set<string>();
  if (!json || typeof json !== "object") return { matches: [], unknownSurfaces: [] };

  const events = (json as Record<string, any>).events || [];
  const seen = new Set<string>();

  for (const ev of events) {
    const tournament = ev.name || "";
    const venue = ev.venue?.displayName || "";
    const surface = resolveSurface(surfaceMap, tournament, venue);
    if (surface === null) unknown.add(tournament);

    for (const grouping of ev.groupings || []) {
      const slug = grouping.grouping?.slug;
      if (!SINGLES.has(slug)) continue;
      const tour: "ATP" | "WTA" = slug === "mens-singles" ? "ATP" : "WTA";

      for (const comp of grouping.competitions || []) {
        if (!comp.status?.type?.completed) continue;
        if (seen.has(String(comp.id))) continue;

        const cs = comp.competitors || [];
        const winner = cs.find((c: any) => c.winner === true);
        const loser = cs.find((c: any) => c.winner === false);
        if (!winner || !loser) continue;

        const wId = competitorId(winner);
        const lId = competitorId(loser);
        if (!wId || !lId || wId === lId) continue;

        seen.add(String(comp.id));
        matches.push({
          competition_id: String(comp.id),
          date: String(comp.date).slice(0, 10),
          tournament,
          surface,
          round: comp.round?.displayName || comp.round?.name || "",
          best_of: comp.format?.regulation?.periods === 5 ? 5 : 3,
          tour,
          winner_espn_id: wId,
          winner_name: winner.athlete?.displayName || "",
          loser_espn_id: lId,
          loser_name: loser.athlete?.displayName || "",
          score: scoreOf(winner, loser),
        });
      }
    }
  }

  return { matches, unknownSurfaces: [...unknown] };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test scripts/espn/parse.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 7: Commit**

```bash
git add scripts/espn/types.ts scripts/espn/parse.ts scripts/espn/parse.test.ts scripts/espn/__fixtures__
git commit -m "feat: parse completed espn singles matches with surface resolution"
```

---

### Task 3: Rankings

**Files:**
- Create: `scripts/espn/rankings.ts`
- Test: `scripts/espn/rankings.test.ts`
- Create: `scripts/espn/__fixtures__/rankings-atp.json`

**Interfaces:**
- Consumes: `RankingEntry` from `./types.ts`
- Produces:
  - `parseRankings(json: unknown, tour: "ATP" | "WTA"): RankingEntry[]` — pure
  - `fetchRankings(tour: "ATP" | "WTA"): Promise<RankingEntry[]>` — I/O
  - `RANKINGS_URL: (tour: string) => string`

- [ ] **Step 1: Capture the fixture**

```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/rankings" \
  > scripts/espn/__fixtures__/rankings-atp.json
```

Confirm it contains `"displayName":"Jannik Sinner"` with `"id":"3623"`. ESPN caps this at 150 entries per tour — that is expected, not a truncated download.

- [ ] **Step 2: Write the failing test**

Create `scripts/espn/rankings.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRankings } from "./rankings.ts";

const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${n}.json`, import.meta.url), "utf8"));

test("parses the ranking list", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  assert.ok(rows.length >= 100, `expected 100+ entries, got ${rows.length}`);
  assert.ok(rows.length <= 150, "espn caps at 150 per tour");
});

test("the anchor player resolves — this is the payload-shape canary", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  const sinner = rows.find((r) => r.espn_id === "3623");
  assert.ok(sinner, "Sinner must resolve to espn_id 3623");
  assert.ok(sinner.rank >= 1 && sinner.rank <= 5, `unexpected rank ${sinner.rank}`);
  assert.ok(sinner.points > 0);
});

test("every entry carries an id, a name and a tour", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  for (const r of rows) {
    assert.ok(r.espn_id, "missing espn_id");
    assert.ok(r.name, "missing name");
    assert.equal(r.tour, "ATP");
  }
});

test("ranks are unique", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  const ranks = rows.map((r) => r.rank);
  assert.equal(new Set(ranks).size, ranks.length);
});

test("malformed input yields an empty list", () => {
  assert.deepEqual(parseRankings(null, "ATP"), []);
  assert.deepEqual(parseRankings({}, "ATP"), []);
  assert.deepEqual(parseRankings({ rankings: [] }, "ATP"), []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/espn/rankings.test.ts`
Expected: FAIL — `Cannot find module './rankings.ts'`

- [ ] **Step 4: Write the implementation**

Create `scripts/espn/rankings.ts`:

```typescript
import type { RankingEntry } from "./types.ts";

export const RANKINGS_URL = (tour: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour.toLowerCase()}/rankings`;

/**
 * Pure. ESPN hard-caps this endpoint at 150 entries per tour — `?limit=500`
 * and `?page=2` both return the same 150. That is accepted: current_rank is
 * display-only and never reaches computeWinProbability.
 */
export function parseRankings(json: unknown, tour: "ATP" | "WTA"): RankingEntry[] {
  if (!json || typeof json !== "object") return [];
  const ranks = (json as Record<string, any>).rankings?.[0]?.ranks || [];

  const out: RankingEntry[] = [];
  for (const r of ranks) {
    const id = r.athlete?.id;
    const name = r.athlete?.displayName;
    if (!id || !name) continue;
    out.push({
      espn_id: String(id),
      name,
      rank: Number(r.current),
      points: Number(r.points) || 0,
      tour,
    });
  }
  return out;
}

/** I/O. Returns an empty list on any failure; the caller decides whether that is fatal. */
export async function fetchRankings(tour: "ATP" | "WTA"): Promise<RankingEntry[]> {
  try {
    const resp = await fetch(RANKINGS_URL(tour));
    if (!resp.ok) return [];
    return parseRankings(await resp.json(), tour);
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test scripts/espn/rankings.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add scripts/espn/rankings.ts scripts/espn/rankings.test.ts scripts/espn/__fixtures__/rankings-atp.json
git commit -m "feat: parse espn rankings with a sinner anchor assertion"
```

---

### Task 4: The match log

**Files:**
- Create: `scripts/espn/log.ts`
- Test: `scripts/espn/log.test.ts`

**Interfaces:**
- Consumes: `MatchRecord` from `./types.ts`
- Produces:
  - `readLog(path: string): MatchRecord[]`
  - `appendMatches(path: string, incoming: MatchRecord[]): { added: number; skipped: number }`
  - `toCsvRows(records: MatchRecord[]): object[]` — shaped like the Sackmann columns the builder reads

`data/results.ndjson` is the asset that makes RallyIQ independent. Appends must be idempotent because `?dates=` returns whole tournaments, so consecutive days re-deliver the same competitions.

- [ ] **Step 1: Write the failing test**

Create `scripts/espn/log.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLog, appendMatches, toCsvRows } from "./log.ts";
import type { MatchRecord } from "./types.ts";

const rec = (id: string, extra: Partial<MatchRecord> = {}): MatchRecord => ({
  competition_id: id,
  date: "2026-07-06",
  tournament: "Wimbledon",
  surface: "Grass",
  round: "R32",
  best_of: 5,
  tour: "ATP",
  winner_espn_id: "3623",
  winner_name: "Jannik Sinner",
  loser_espn_id: "13489",
  loser_name: "Ivan Ivanov",
  score: "6-2 6-2",
  ...extra,
});

const tmpLog = () => path.join(mkdtempSync(path.join(tmpdir(), "rallyiq-")), "results.ndjson");

test("reading a missing file yields an empty log", () => {
  assert.deepEqual(readLog(path.join(tmpdir(), "definitely-absent.ndjson")), []);
});

test("appends new records", () => {
  const p = tmpLog();
  const r = appendMatches(p, [rec("1"), rec("2")]);
  assert.deepEqual(r, { added: 2, skipped: 0 });
  assert.equal(readLog(p).length, 2);
});

test("appending the same competitions twice changes nothing", () => {
  const p = tmpLog();
  appendMatches(p, [rec("1"), rec("2")]);
  const second = appendMatches(p, [rec("1"), rec("2")]);
  assert.deepEqual(second, { added: 0, skipped: 2 });
  assert.equal(readLog(p).length, 2);
  assert.equal(readFileSync(p, "utf8").trim().split("\n").length, 2);
});

test("dedupes within a single batch", () => {
  const p = tmpLog();
  const r = appendMatches(p, [rec("1"), rec("1"), rec("3")]);
  assert.deepEqual(r, { added: 2, skipped: 1 });
});

test("survives a trailing newline and blank lines", () => {
  const p = tmpLog();
  writeFileSync(p, JSON.stringify(rec("1")) + "\n\n");
  assert.equal(readLog(p).length, 1);
  assert.deepEqual(appendMatches(p, [rec("1")]), { added: 0, skipped: 1 });
});

test("toCsvRows emits the columns build-ratings reads", () => {
  const [row] = toCsvRows([rec("1")]) as any[];
  assert.equal(row.tourney_date, "20260706");
  assert.equal(row.surface, "Grass");
  assert.equal(row.winner_name, "Jannik Sinner");
  assert.equal(row.loser_name, "Ivan Ivanov");
  assert.equal(row.score, "6-2 6-2");
  assert.equal(row.round, "R32");
  for (const col of ["w_svpt", "w_1stWon", "w_2ndWon", "l_svpt"]) {
    assert.equal(row[col], "", `${col} must be empty — espn has no serve stats`);
  }
});

test("toCsvRows drops matches with no surface", () => {
  assert.equal(toCsvRows([rec("1", { surface: null })]).length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/espn/log.test.ts`
Expected: FAIL — `Cannot find module './log.ts'`

- [ ] **Step 3: Write the implementation**

Create `scripts/espn/log.ts`:

```typescript
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import type { MatchRecord } from "./types.ts";

/** One JSON object per line. Blank lines and unparseable lines are skipped. */
export function readLog(path: string): MatchRecord[] {
  if (!existsSync(path)) return [];
  const out: MatchRecord[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Append-only, keyed on ESPN competition id. ?dates= returns whole tournaments,
 * so the same competition arrives on every run during a tournament week; this
 * is what keeps that from duplicating the log.
 */
export function appendMatches(
  path: string,
  incoming: MatchRecord[],
): { added: number; skipped: number } {
  const seen = new Set(readLog(path).map((m) => m.competition_id));
  const lines: string[] = [];
  let skipped = 0;

  for (const m of incoming) {
    if (seen.has(m.competition_id)) {
      skipped++;
      continue;
    }
    seen.add(m.competition_id);
    lines.push(JSON.stringify(m));
  }

  if (lines.length) appendFileSync(path, lines.join("\n") + "\n");
  return { added: lines.length, skipped };
}

/**
 * Shape a MatchRecord like a Sackmann CSV row so build-ratings.mjs can consume
 * it unchanged. The four serve-stat columns are empty on purpose: ESPN returns
 * `statistics: []`, so hold_pct and break_pct stay frozen at 2026-05-17 rather
 * than being computed from nothing.
 */
export function toCsvRows(records: MatchRecord[]): object[] {
  return records
    .filter((m) => m.surface !== null)
    .map((m) => ({
      tourney_date: m.date.replace(/-/g, ""),
      tourney_name: m.tournament,
      surface: m.surface,
      winner_id: m.winner_espn_id,
      winner_name: m.winner_name,
      loser_id: m.loser_espn_id,
      loser_name: m.loser_name,
      score: m.score,
      best_of: String(m.best_of),
      round: m.round,
      w_svpt: "",
      w_1stWon: "",
      w_2ndWon: "",
      l_svpt: "",
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/espn/log.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/espn/log.ts scripts/espn/log.test.ts
git commit -m "feat: idempotent ndjson match log keyed on competition id"
```

---

### Task 5: Player identity

**Files:**
- Create: `scripts/espn/identity.ts`
- Test: `scripts/espn/identity.test.ts`

**Interfaces:**
- Consumes: `normalizeName` from `./surface.ts`, `RankingEntry` from `./types.ts`
- Produces:
  - `interface Rating { player_id: string; name: string; tour: string; espn_id?: string }`
  - `buildIdentityMap(ratings: Rating[], rankings: RankingEntry[], observed: Array<{espn_id: string; name: string; tour: "ATP"|"WTA"}>): { map: Record<string,string>; unmatched: string[] }`
  - `resolvePlayerId(map: Record<string,string>, espn_id: string): string`

This is the **only** place fuzzy name matching happens. Everything downstream joins on `espn_id`. `player_id` for the existing 1,575 never changes, because `Bet.playerExternalId` is a loose string with no foreign key and reassigning ids orphans bets with no error.

- [ ] **Step 1: Write the failing test**

Create `scripts/espn/identity.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIdentityMap, resolvePlayerId, type Rating } from "./identity.ts";
import type { RankingEntry } from "./types.ts";

const RATINGS: Rating[] = [
  { player_id: "206173", name: "Jannik Sinner", tour: "ATP" },
  { player_id: "126205", name: "Tommy Paul", tour: "ATP" },
  { player_id: "polona_hercog", name: "Polona Hercog", tour: "WTA" },
];

const RANKINGS: RankingEntry[] = [
  { espn_id: "3623", name: "Jannik Sinner", rank: 1, points: 13450, tour: "ATP" },
  { espn_id: "4879", name: "Tommy Paul", rank: 12, points: 2100, tour: "ATP" },
];

test("maps espn ids onto existing sackmann player ids", () => {
  const { map } = buildIdentityMap(RATINGS, RANKINGS, []);
  assert.equal(map["3623"], "206173");
  assert.equal(map["4879"], "126205");
});

test("matching ignores case, accents and punctuation", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "999", name: "Stan Wawrinka", tour: "ATP" }],
    [{ espn_id: "111", name: "STAN  WAWRINKA", rank: 40, points: 900, tour: "ATP" }],
    [],
  );
  assert.equal(map["111"], "999");
});

test("resolves a player previously stuck on a slug id", () => {
  const { map } = buildIdentityMap(RATINGS, RANKINGS, [
    { espn_id: "555", name: "Polona Hercog", tour: "WTA" },
  ]);
  assert.equal(map["555"], "polona_hercog", "existing player_id must be preserved, not replaced");
});

test("a player espn knows but ratings does not gets an espn_ prefixed id", () => {
  const { map } = buildIdentityMap(RATINGS, RANKINGS, [
    { espn_id: "777", name: "Some Newcomer", tour: "ATP" },
  ]);
  assert.equal(map["777"], "espn_777");
});

test("names that resolve to nobody are reported", () => {
  const { unmatched } = buildIdentityMap(RATINGS, RANKINGS, [
    { espn_id: "777", name: "Some Newcomer", tour: "ATP" },
  ]);
  assert.deepEqual(unmatched, ["Some Newcomer"]);
});

test("a name matching two different players is left unmatched rather than guessed", () => {
  const { map, unmatched } = buildIdentityMap(
    [
      { player_id: "1", name: "Alex Molcan", tour: "ATP" },
      { player_id: "2", name: "Alex Molcan", tour: "ATP" },
    ],
    [{ espn_id: "888", name: "Alex Molcan", rank: 90, points: 600, tour: "ATP" }],
    [],
  );
  assert.equal(map["888"], undefined);
  assert.deepEqual(unmatched, ["Alex Molcan"]);
});

test("cross-tour name collisions do not match", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "1", name: "Jan Novak", tour: "ATP" }],
    [{ espn_id: "888", name: "Jan Novak", rank: 90, points: 600, tour: "WTA" }],
    [],
  );
  assert.equal(map["888"], undefined);
});

test("resolvePlayerId falls back to the espn_ form", () => {
  assert.equal(resolvePlayerId({ "3623": "206173" }, "3623"), "206173");
  assert.equal(resolvePlayerId({}, "9999"), "espn_9999");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/espn/identity.test.ts`
Expected: FAIL — `Cannot find module './identity.ts'`

- [ ] **Step 3: Write the implementation**

Create `scripts/espn/identity.ts`:

```typescript
import { normalizeName } from "./surface.ts";
import type { RankingEntry } from "./types.ts";

export interface Rating {
  player_id: string;
  name: string;
  tour: string;
  espn_id?: string;
}

/**
 * Builds espn_id -> player_id once, by name. Ambiguous names (the same
 * normalized name on two rating rows for one tour) are deliberately left
 * unmatched: a wrong join silently merges two players' careers into one Elo.
 */
export function buildIdentityMap(
  ratings: Rating[],
  rankings: RankingEntry[],
  observed: Array<{ espn_id: string; name: string; tour: "ATP" | "WTA" }>,
): { map: Record<string, string>; unmatched: string[] } {
  const byName = new Map<string, string[]>();
  for (const r of ratings) {
    const key = `${r.tour}|${normalizeName(r.name)}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r.player_id);
  }

  const map: Record<string, string> = {};
  const unmatched: string[] = [];

  const consider = (espn_id: string, name: string, tour: string) => {
    if (map[espn_id]) return;
    const hits = byName.get(`${tour}|${normalizeName(name)}`) || [];
    if (hits.length === 1) {
      map[espn_id] = hits[0];
    } else if (hits.length === 0) {
      unmatched.push(name);
    } else {
      unmatched.push(name);
    }
  };

  for (const r of rankings) consider(r.espn_id, r.name, r.tour);
  for (const o of observed) consider(o.espn_id, o.name, o.tour);

  return { map, unmatched: [...new Set(unmatched)] };
}

/**
 * Players first seen after the Sackmann era get `espn_<id>`. Mixed-format ids
 * are fine — they are opaque strings, and this already happened accidentally
 * with polona_hercog.
 */
export function resolvePlayerId(map: Record<string, string>, espn_id: string): string {
  return map[espn_id] ?? `espn_${espn_id}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/espn/identity.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/espn/identity.ts scripts/espn/identity.test.ts
git commit -m "feat: espn_id to player_id map, ambiguous names left unmatched"
```

---

### Task 6: The backfill CLI

**Files:**
- Create: `scripts/espn/backfill.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `parseScoreboard` from `./parse.ts`, `buildSurfaceMap` from `./surface.ts`, `appendMatches`/`readLog` from `./log.ts`
- Produces: a CLI. No exported API.

`?dates=` returns whole tournaments, so the backfill walks the gap in **weekly steps** rather than daily — 12 weeks of coverage costs roughly 24 requests instead of 168, and the dedupe in Task 4 absorbs the overlap.

- [ ] **Step 1: Write the CLI**

Create `scripts/espn/backfill.ts`:

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { buildSurfaceMap } from "./surface.ts";
import { parseScoreboard } from "./parse.ts";
import { appendMatches, readLog } from "./log.ts";
import type { MatchRecord } from "./types.ts";

const APPLY = process.argv.includes("--apply");
const fromArg = process.argv.indexOf("--from");
const FROM = fromArg > -1 ? process.argv[fromArg + 1] : "2026-05-18";

const LOG = "data/results.ndjson";
const UNMATCHED = "data/unmatched.json";
const MIN_EXPECTED = 500;

const SCOREBOARD = (tour: string, yyyymmdd: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${yyyymmdd}`;

function* weeks(from: string, to: string): Generator<string> {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10).replace(/-/g, "");
    d.setUTCDate(d.getUTCDate() + 7);
  }
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (writes the log)" : "MODE: DRY RUN (no writes)");

  const surfaces = buildSurfaceMap(
    "data",
    JSON.parse(readFileSync("data/surface-overrides.json", "utf8")),
  );
  console.log(`surface map: ${surfaces.size} tournaments`);

  const today = new Date().toISOString().slice(0, 10);
  const all = new Map<string, MatchRecord>();
  const unknownSurfaces = new Set<string>();

  for (const week of weeks(FROM, today)) {
    for (const tour of ["atp", "wta"]) {
      let json: unknown;
      try {
        const resp = await fetch(SCOREBOARD(tour, week));
        if (!resp.ok) {
          console.log(`  ${tour} ${week}: HTTP ${resp.status}`);
          continue;
        }
        json = await resp.json();
      } catch (e) {
        console.log(`  ${tour} ${week}: fetch failed — ${(e as Error).message}`);
        continue;
      }

      const { matches, unknownSurfaces: unknown } = parseScoreboard(json, surfaces);
      for (const m of matches) all.set(m.competition_id, m);
      for (const u of unknown) unknownSurfaces.add(u);
      console.log(`  ${tour} ${week}: ${matches.length} completed singles`);
    }
  }

  const records = [...all.values()].sort((a, b) => a.date.localeCompare(b.date));
  const noSurface = records.filter((r) => r.surface === null).length;

  console.log(`\ndistinct completed singles matches: ${records.length}`);
  console.log(`  without a resolved surface: ${noSurface}`);
  console.log(`  already in the log: ${readLog(LOG).length}`);
  if (unknownSurfaces.size) {
    console.log(`unresolved tournaments: ${[...unknownSurfaces].join(" | ")}`);
  }

  // The invariant: a run that produces nothing must fail rather than commit.
  if (records.length < MIN_EXPECTED) {
    console.error(`\nFAIL: expected at least ${MIN_EXPECTED} matches, got ${records.length}.`);
    console.error("Either the gap is already closed or ESPN changed shape. Not writing.");
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\ndry run — nothing written");
    return;
  }

  const { added, skipped } = appendMatches(LOG, records);
  writeFileSync(UNMATCHED, JSON.stringify({ tournaments: [...unknownSurfaces] }, null, 1));
  console.log(`\nappended: ${added}, already present: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm scripts**

In `package.json` `"scripts"`:

```json
"espn:backfill": "node scripts/espn/backfill.ts",
"espn:backfill:apply": "node scripts/espn/backfill.ts --apply"
```

- [ ] **Step 3: Dry run and read the output**

Run: `npm run espn:backfill`

Expected: roughly 24 week-fetches, and a distinct-match count in the **1,500–2,000** range. The 2025 yardstick for the same window was ~854 ATP + ~918 WTA.

**Stop and read the output before continuing.** If the count is under 500 the script exits non-zero by design. If it is above 3,000, doubles or non-completed matches are leaking through — fix Task 2's filter before writing anything.

- [ ] **Step 4: Apply**

Run: `npm run espn:backfill:apply`

- [ ] **Step 5: Verify the log**

```bash
wc -l data/results.ndjson
node -e "
const fs=require('fs');
const rows=fs.readFileSync('data/results.ndjson','utf8').trim().split('\n').map(JSON.parse);
const ids=new Set(rows.map(r=>r.competition_id));
console.log('rows:',rows.length,'distinct competitions:',ids.size);
console.log('date range:',rows[0].date,'->',rows[rows.length-1].date);
console.log('no surface:',rows.filter(r=>!r.surface).length);
const t=new Set(rows.map(r=>r.tournament));
console.log('tournaments:',t.size);
console.log('has wimbledon:',[...t].some(x=>/wimbledon/i.test(x)));
"
```

Expected: rows equals distinct competitions, the range starts on or after 2026-05-18, and Wimbledon is present.

- [ ] **Step 6: Run the backfill a second time to prove idempotency**

Run: `npm run espn:backfill:apply`
Expected: `appended: 0` and `wc -l` unchanged.

- [ ] **Step 7: Commit**

```bash
git add scripts/espn/backfill.ts package.json data/results.ndjson data/unmatched.json
git commit -m "feat: backfill the espn match log from 2026-05-18"
```

---

### Task 7: Repoint the ratings builder

**Files:**
- Modify: `scripts/build-ratings.mjs`
- Test: `scripts/espn/continuity.test.ts` (create)

**Interfaces:**
- Consumes: `readLog` and `toCsvRows` from `./log.ts`, `buildIdentityMap`/`resolvePlayerId` from `./identity.ts`
- Produces: `data/ratings.json` in its existing shape — no consumer changes

The builder's Elo math does not change. Only its inputs do: local CSVs instead of `raw.githubusercontent.com`, plus the new log appended after them.

- [ ] **Step 1: Write the continuity test first**

Create `scripts/espn/continuity.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * The 2026-06-02 ratings.json was built from the Sackmann CSVs alone. Rebuilding
 * from those same CSVs must reproduce it. If it does not, the repointed builder
 * has drifted and nothing it produces for the gap window can be trusted.
 *
 * Requires: cp data/ratings.json data/ratings.baseline.json before Task 7 edits,
 * then `npm run ratings:build -- --base-only` after.
 */
test("rebuilding from the csv base reproduces the 2026-06-02 ratings", (t) => {
  if (!existsSync("data/ratings.baseline.json")) {
    t.skip("no baseline captured — run step 2 first");
    return;
  }
  const baseline = JSON.parse(readFileSync("data/ratings.baseline.json", "utf8"));
  const rebuilt = JSON.parse(readFileSync("data/ratings.json", "utf8"));

  const byId = new Map(rebuilt.map((p: any) => [p.player_id, p]));
  assert.ok(rebuilt.length >= baseline.length - 5, `lost players: ${baseline.length} -> ${rebuilt.length}`);

  let drifted = 0;
  for (const b of baseline) {
    const r: any = byId.get(b.player_id);
    if (!r) continue;
    if (Math.abs(r.elo_overall - b.elo_overall) > 1.0) drifted++;
  }
  assert.equal(drifted, 0, `${drifted} players drifted more than 1 Elo point from the baseline`);
});
```

- [ ] **Step 2: Capture the baseline**

```bash
cp data/ratings.json data/ratings.baseline.json
git add data/ratings.baseline.json
git commit -m "chore: snapshot the 2026-06-02 ratings as an elo continuity baseline"
```

- [ ] **Step 3: Replace the source block in build-ratings.mjs**

In `scripts/build-ratings.mjs`, replace the `ATP_SOURCES` / `WTA_SOURCES` / `RANKING_SOURCES` constants and whatever fetches them with local reads. Keep every Elo constant (`ELO_START`, `K_BASE`, `K_SURFACE`, `ROOKIE_BONUS`, `SURFACE_MAP`) and `gameWinProb` byte-for-byte unchanged:

```javascript
import { readLog, toCsvRows } from './espn/log.ts'

const DATA_DIR = path.join(__dirname, '../data')
const BASE_ONLY = process.argv.includes('--base-only')

// The committed Sackmann snapshot: 2022-01-01 -> 2026-05-17. Frozen, and the
// upstream repos no longer exist, so this is the archive.
const ATP_SOURCES = [2022, 2023, 2024, 2025, 2026].map(year => ({
  file: path.join(DATA_DIR, `atp_matches_${year}.csv`), tour: 'ATP', year,
}))

const WTA_SOURCES = [2022, 2023, 2024, 2025, 2026].map(year => ({
  file: path.join(DATA_DIR, `wta_matches_${year}.csv`), tour: 'WTA', year,
}))

const RANKING_SOURCES = [
  { file: path.join(DATA_DIR, 'atp_rankings_current.csv'), tour: 'ATP' },
  { file: path.join(DATA_DIR, 'wta_rankings_current.csv'), tour: 'WTA' },
]

function loadCsv(file) {
  if (!fs.existsSync(file)) {
    console.error(`MISSING: ${file}`)
    process.exit(1)
  }
  return parseCSV(fs.readFileSync(file, 'utf8'))
}

/** Everything after 2026-05-17 comes from the ESPN log, not from a CSV. */
function loadEspnRows(tour) {
  if (BASE_ONLY) return []
  return toCsvRows(readLog(path.join(DATA_DIR, 'results.ndjson')).filter(m => m.tour === tour))
}
```

Then, wherever the builder previously did `await fetchCsv(src.url)`, use `loadCsv(src.file)`, and after loading a tour's CSV rows, concatenate `loadEspnRows(tour)` before the Elo pass. Matches must stay sorted by `tourney_date` ascending or the Elo sequence is wrong.

- [ ] **Step 4: Verify the builder still parses TypeScript imports**

Run: `node scripts/build-ratings.mjs --base-only`

Expected: it completes and writes `data/ratings.json`. If it fails with `Unknown file extension ".ts"`, Node cannot strip types for a `.ts` file imported from `.mjs` in this version — in that case, inline `readLog` and `toCsvRows` as plain JavaScript in `build-ratings.mjs` and delete the import. Do not add a build step.

- [ ] **Step 5: Run the continuity test**

Run: `node --test scripts/espn/continuity.test.ts`
Expected: PASS — 0 players drifted.

**If players drifted, stop.** The repointed builder is not equivalent to the one that produced the live ratings, and the gap fill would bake that difference into every rating.

- [ ] **Step 6: Build for real, with the log included**

Run: `npm run ratings:build`

Then check the gap actually closed:

```bash
node -e "
const r=require('./data/ratings.json');
console.log('players:',r.length);
console.log('grass stuck at 1500:',r.filter(p=>p.elo_grass===1500).length,'(was 1032)');
console.log('under 5 matches:',r.filter(p=>p.matches_played<5).length,'(was 749)');
console.log('no rank:',r.filter(p=>!p.current_rank).length,'(was 395)');
"
```

Expected: the grass and match-count figures drop substantially. `no rank` will **rise**, because ESPN only publishes 150 per tour against Sackmann's ~1,180 — that is the accepted regression, not a bug.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-ratings.mjs scripts/espn/continuity.test.ts data/ratings.json
git commit -m "refactor: build ratings from committed csvs plus the espn log"
```

---

### Task 8: Stop the silent slug in fetch-today

**Files:**
- Modify: `scripts/fetch-today.ts:88`
- Test: `scripts/espn/identity.test.ts` (extend)

**Interfaces:**
- Consumes: `resolvePlayerId` from `./identity.ts`
- Produces: no new API — a behavior change

`fetch-today.ts:88` currently reads `return idx.get(last) ?? slugify(name)`. That line is why `polona_hercog`, `tena_lukas`, `alina_charaeva` and `teodora_kostovic` sit in `today.json` with no rating: an unresolved name becomes a plausible-looking id that matches nothing and reports nothing.

- [ ] **Step 1: Write the failing test**

Append to `scripts/espn/identity.test.ts`:

```typescript
import { playerIdForToday } from "./identity.ts";

test("a resolvable name uses its existing player_id", () => {
  const unresolved: string[] = [];
  const id = playerIdForToday(new Map([["jannik sinner", "206173"]]), "3623", "Jannik Sinner", unresolved);
  assert.equal(id, "206173");
  assert.deepEqual(unresolved, []);
});

test("an unresolvable name gets an espn id and is recorded, never slugified", () => {
  const unresolved: string[] = [];
  const id = playerIdForToday(new Map(), "555", "Teodora Kostovic", unresolved);
  assert.equal(id, "espn_555");
  assert.notEqual(id, "teodora_kostovic");
  assert.deepEqual(unresolved, ["Teodora Kostovic"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/espn/identity.test.ts`
Expected: FAIL — `does not provide an export named 'playerIdForToday'`

- [ ] **Step 3: Add the function**

Append to `scripts/espn/identity.ts`:

```typescript
/**
 * The id used when writing today.json. An unresolved name becomes espn_<id>,
 * which is at least joinable, and is recorded in `unresolved` for review.
 * It must never become a slug: a slug looks like a real id, matches nothing,
 * and produced four ratingless players in today.json.
 */
export function playerIdForToday(
  nameIndex: Map<string, string>,
  espn_id: string,
  name: string,
  unresolved: string[],
): string {
  const hit = nameIndex.get(normalizeName(name)) ?? nameIndex.get(name.toLowerCase());
  if (hit) return hit;
  unresolved.push(name);
  return `espn_${espn_id}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/espn/identity.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Use it in fetch-today.ts**

In `scripts/fetch-today.ts`, delete the `slugify` function and its use at line 88. Replace the id lookup with `playerIdForToday`, collecting unresolved names, and write them to `data/unmatched.json` at the end of the run alongside a count on stdout. Extract each competitor's ESPN id with the same `competitorId` helper from `./espn/parse.ts` rather than re-implementing it.

- [ ] **Step 6: Run it and confirm no slugs appear**

Run: `npm run fetch:today`

```bash
node -e "
const t=require('./data/today.json');
const slugs=t.flatMap(m=>[m.player1_id,m.player2_id]).filter(id=>/^[a-z]+_[a-z]+$/.test(id));
console.log('matches:',t.length,'| slug ids:',slugs.length, slugs);
"
```

Expected: `slug ids: 0`. Any unresolved player now shows as `espn_<digits>` and is listed in `data/unmatched.json`.

- [ ] **Step 7: Commit**

```bash
git add scripts/fetch-today.ts scripts/espn/identity.ts scripts/espn/identity.test.ts data/today.json data/unmatched.json
git commit -m "fix: stop slugifying unresolved player names in today.json"
```

---

### Task 9: Repoint the workflow

**Files:**
- Modify: `.github/workflows/rebuild-ratings.yml`

**Interfaces:**
- Consumes: the `espn:backfill:apply` and `ratings:build` npm scripts
- Produces: nothing consumed by later tasks

The workflow ran green six consecutive times while fetching zero matches, because `build-ratings.mjs` caught 404s, warned, and exited 0, and `git diff --staged --quiet || git commit` reads "nothing changed" as success. Task 6's script already exits non-zero below `MIN_EXPECTED`; the workflow has to stop swallowing that.

- [ ] **Step 1: Rewrite the workflow**

Replace `.github/workflows/rebuild-ratings.yml`:

```yaml
name: refresh ratings

on:
  schedule:
    - cron: "0 7 * * *"
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Append yesterday's matches to the log
        run: node scripts/espn/backfill.ts --apply --from $(date -u -d '10 days ago' +%Y-%m-%d)

      - name: Rebuild ratings
        run: npm run ratings:build

      - name: Refresh today's slate
        run: npm run fetch:today

      - name: Fail if nothing was produced
        run: |
          test -s data/ratings.json || { echo "ratings.json is empty"; exit 1; }
          test -s data/results.ndjson || { echo "results.ndjson is empty"; exit 1; }

      - name: Commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/ratings.json data/results.ndjson data/today.json data/unmatched.json
          if git diff --staged --quiet; then
            echo "no changes"
          else
            git commit -m "chore: daily ratings refresh"
            git push
          fi
```

The 10-day lookback exists because `?dates=` returns whole tournaments: a match played today may not be marked completed until the event finishes, and re-fetching the last 10 days costs about 4 requests while the log's dedupe absorbs the overlap.

- [ ] **Step 2: Trigger it manually and read the log**

Push the branch, then run the workflow via `workflow_dispatch` in the Actions tab.

**Read the run log, do not just check for a green tick.** Confirm it printed a non-zero match count and that the commit step either pushed or explicitly said "no changes". A green run that fetched nothing is the exact failure this whole plan exists to prevent.

- [ ] **Step 3: Verify the commit landed**

```bash
git pull
git log --oneline -1 -- data/results.ndjson
```

Expected: a `chore: daily ratings refresh` commit authored by github-actions, dated today.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/rebuild-ratings.yml
git commit -m "fix: repoint the ratings workflow at espn and fail on empty"
```

---

### Task 10: Record the state

**Files:**
- Modify: `data/README.md`
- Modify: `CLAUDE.md` (create if absent)

**Interfaces:**
- Consumes: everything above
- Produces: nothing

`data/README.md` currently documents the Vercel cron as the automation story. That cron never ran and has been deleted.

- [ ] **Step 1: Rewrite the automation section of data/README.md**

Replace any mention of the Vercel cron with:

```markdown
## How this data stays current

GitHub Actions (`.github/workflows/rebuild-ratings.yml`) runs daily at 07:00 UTC:

1. `scripts/espn/backfill.ts --apply` appends the last 10 days of completed
   singles matches to `data/results.ndjson`, deduped by ESPN competition id.
2. `scripts/build-ratings.mjs` rebuilds `data/ratings.json` from the committed
   CSVs (2022 → 2026-05-17) plus that log.
3. `scripts/fetch-today.ts` rewrites `data/today.json`.

The CSVs are committed, not fetched. JeffSackmann/tennis_atp and tennis_wta were
deleted upstream in June 2026 with no mirror; git is the archive now.

Known gaps, deliberate:

- `hold_pct` and `break_pct` are frozen at 2026-05-17. ESPN returns
  `statistics: []`, and no free source replaces Sackmann's serve columns.
- `current_rank` covers the top 150 per tour only. ESPN caps the rankings
  endpoint there. Rank is display-only and never reaches the model.
- Surface comes from the committed CSVs by tournament name, with
  `data/surface-overrides.json` for events that are not in them. A tournament
  that resolves to no surface is listed in `data/unmatched.json` and its
  matches do not update surface Elo.
```

- [ ] **Step 2: Record the conventions in CLAUDE.md**

Add (creating the file if it does not exist):

```markdown
## Data pipeline

- ESPN is the sole upstream. `site.api.espn.com` is public but undocumented and
  unversioned — assert structure, fail loudly, never parse optimistically.
- **`?dates=YYYYMMDD` returns whole tournaments, not one day.** Wimbledon comes
  back as 635 competitions spanning 18 days. Always dedupe on competition id.
- **ESPN publishes no surface.** `"court"` is a court name. Surface is resolved
  from the committed CSVs via `scripts/espn/surface.ts`; unknown means null, and
  null never becomes "Hard".
- `data/*.csv` is committed on purpose. Do not re-add it to `.gitignore`.
- `player_id` never changes for the 1,575 pre-ESPN players — `Bet.playerExternalId`
  is a loose string with no foreign key, so reassigning ids orphans bets silently.
- `scripts/espn` is excluded from `tsconfig.json`: Node needs explicit `.ts`
  import extensions, Next's typecheck rejects them.
```

- [ ] **Step 3: Confirm the whole suite and build are green**

Run: `npm test && npm run build && npm run lint`
Expected: all pass — 39 tests (7 surface + 9 parse + 5 rankings + 7 log + 10 identity + 1 continuity), plus any you added.

- [ ] **Step 4: Commit**

```bash
git add data/README.md CLAUDE.md
git commit -m "docs: record the espn pipeline and its deliberate gaps"
```

---

## Deferred to later plans

- **The refresh layer (Phase 3).** `health.json` per repo, the staleness banner, signal suppression past double the threshold. This plan makes the workflow fail loudly; it does not yet publish health.
- **`/admin/health` (Phase 4).** The cross-app aggregate page.
- **Real odds.** `fetchRealOdds` and `ODDS_API_KEY` exist and cover 24 tournaments, but every render path instantiates `MockOddsProvider`. Auditing that is separate work.
- **Deep rankings.** No free source beyond ESPN's 150/tour cap was found.
- **`hold_pct` / `break_pct`.** Frozen. They should be labelled with an as-of date in the UI and excluded from signal computation — a frozen input feeding live edge math is the same failure as mock odds.
