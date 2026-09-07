import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildIdentityMap } from "./espn/identity.ts";
import { readLog, afterBase } from "./espn/log.ts";
import { canonicalName, tournamentSlug } from "../src/lib/search/slug.ts";

/**
 * Builds data/search-index.json — the season's tournaments, players and results
 * in one file the app can read without re-deriving anything.
 *
 * It is generated here rather than assembled per request because the join is
 * not cheap and cannot live in src/ anyway. results.ndjson stores ESPN ids
 * while ratings.json stores Sackmann player_ids, and the bridge is
 * buildIdentityMap — fuzzy name matching over thousands of names, rebuilt on
 * every ratings build and never written to disk. tsconfig.json excludes
 * scripts/, so the app cannot import it. Doing that work once a day at build
 * time is the only sensible place for it.
 *
 * Scope is the current season. The CSVs cover 2026-01-01 to 2026-05-17 and the
 * ESPN log covers 2026-05-18 onward, and the two use entirely different
 * tournament names — see src/lib/search/slug.ts for how they are reconciled.
 */

const SEASON = 2026;
const DATA = "data";
const OUT = path.join(DATA, "search-index.json");

interface Row {
  slug: string;
  name: string;
  date: string; // YYYY-MM-DD
  surface: string | null;
  round: string;
  best_of: number;
  tour: "ATP" | "WTA";
  winner: string; // tour-playerid
  loser: string;
  score: string;
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        vals.push(cur);
        cur = "";
      } else cur += ch;
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (vals[i] ?? "").trim()));
    return row;
  });
}

const ref = (tour: string, playerId: string) => `${tour.toLowerCase()}-${playerId}`;

/** CSV rows already carry Sackmann ids, so no identity work is needed here. */
function csvRows(tour: "ATP" | "WTA"): Row[] {
  const file = path.join(DATA, `${tour.toLowerCase()}_matches_${SEASON}.csv`);
  const out: Row[] = [];
  for (const r of parseCSV(readFileSync(file, "utf8"))) {
    const d = r.tourney_date;
    if (!d || d.length !== 8 || !r.winner_id || !r.loser_id) continue;
    const name = r.tourney_name;
    out.push({
      slug: tournamentSlug(name),
      name: canonicalName(name),
      // tourney_date is the tournament's start date, not the match's. Every
      // pre-cutoff row therefore shares one date; the index reports that as a
      // start with no end rather than inventing a range.
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      surface: r.surface || null,
      round: r.round || "",
      best_of: Number(r.best_of) || 3,
      tour,
      winner: ref(tour, r.winner_id),
      loser: ref(tour, r.loser_id),
      score: r.score || "",
    });
  }
  return out;
}

function main() {
  const ratings = JSON.parse(readFileSync(path.join(DATA, "ratings.json"), "utf8"));
  if (!ratings.length) {
    console.error("FAIL: ratings.json is empty — refusing to build an index over nothing.");
    process.exit(1);
  }

  // afterBase, not the raw log: the CSVs already contain everything up to the
  // cutoff, and Geneva, Hamburg, Stuttgart, Strasbourg and Rabat straddle it.
  const log = afterBase(readLog(path.join(DATA, "results.ndjson")));

  const observed = log.flatMap((m) => [
    { espn_id: m.winner_espn_id, name: m.winner_name, tour: m.tour },
    { espn_id: m.loser_espn_id, name: m.loser_name, tour: m.tour },
  ]);
  const overridePath = path.join(DATA, "identity-overrides.json");
  const overrides = JSON.parse(readFileSync(overridePath, "utf8"));
  const { map: identity } = buildIdentityMap(ratings, [], observed, overrides);

  const rows: Row[] = [...csvRows("ATP"), ...csvRows("WTA")];
  let unresolved = 0;
  for (const m of log) {
    const w = identity[m.winner_espn_id];
    const l = identity[m.loser_espn_id];
    if (!w || !l) {
      // A player the roster could not name. Skipping the row keeps the index's
      // referential integrity; the count is reported rather than swallowed.
      unresolved++;
      continue;
    }
    rows.push({
      slug: tournamentSlug(m.tournament),
      name: canonicalName(m.tournament),
      date: m.date,
      surface: m.surface,
      round: m.round,
      best_of: m.best_of,
      tour: m.tour,
      winner: ref(m.tour, w),
      loser: ref(m.tour, l),
      score: m.score,
    });
  }

  // ── tournaments ──────────────────────────────────────────────────────────
  const byTournament = new Map<
    string,
    { slug: string; name: string; tours: Set<string>; surfaces: Map<string, number>; start: string; end: string; matches: number }
  >();
  for (const r of rows) {
    let t = byTournament.get(r.slug);
    if (!t) {
      t = { slug: r.slug, name: r.name, tours: new Set(), surfaces: new Map(), start: r.date, end: r.date, matches: 0 };
      byTournament.set(r.slug, t);
    }
    t.tours.add(r.tour);
    if (r.surface) t.surfaces.set(r.surface, (t.surfaces.get(r.surface) ?? 0) + 1);
    if (r.date < t.start) t.start = r.date;
    if (r.date > t.end) t.end = r.date;
    t.matches++;
  }

  const tournaments = [...byTournament.values()]
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      tours: [...t.tours].sort(),
      // Davis Cup ties are played worldwide on whatever the host uses, so the
      // most common surface is the honest summary rather than a single truth.
      surface: [...t.surfaces].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      start: t.start,
      end: t.end,
      matches: t.matches,
    }))
    .sort((a, b) => b.start.localeCompare(a.start));

  // ── players ──────────────────────────────────────────────────────────────
  const players = ratings
    .map((p: any) => ({
      id: ref(p.tour, p.player_id),
      tour: p.tour,
      player_id: p.player_id,
      name: p.name,
      rank: p.current_rank ?? null,
      elo: Math.round(p.elo_overall * 10) / 10,
    }))
    .sort((a: any, b: any) => b.elo - a.elo);

  // ── results ──────────────────────────────────────────────────────────────
  const known = new Set(players.map((p: any) => p.id));
  const results = rows
    .filter((r) => known.has(r.winner) && known.has(r.loser))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({ s: r.slug, d: r.date, r: r.round, b: r.best_of, w: r.winner, l: r.loser, sc: r.score }));

  const index = {
    season: SEASON,
    generated: new Date().toISOString(),
    tournaments,
    players,
    results,
  };

  if (tournaments.length < 40) {
    console.error(`FAIL: only ${tournaments.length} tournaments — the season should have far more.`);
    process.exit(1);
  }

  writeFileSync(OUT, JSON.stringify(index) + "\n");
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `✓ ${OUT}: ${tournaments.length} tournaments, ${players.length} players, ${results.length} results (${kb} KB)`,
  );
  if (unresolved) console.log(`  ${unresolved} log rows skipped — player not resolvable to the roster`);
  const dropped = rows.length - results.length;
  if (dropped) console.log(`  ${dropped} rows dropped — player id not in ratings.json`);
}

main();
