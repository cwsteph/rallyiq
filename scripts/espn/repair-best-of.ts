import { readFileSync, writeFileSync } from "node:fs";
import { bestOf } from "./parse.ts";
import type { MatchRecord } from "./types.ts";

/**
 * One-off repair for rows written before best_of was derived from the grouping
 * slug. `format.regulation.periods` is an endpoint property — /atp reports 5
 * for everything it returns, /wta reports 3 — and backfill.ts's dedupe map is
 * last-write-wins with /wta fetched second. Combined events (both endpoints
 * return them) took the WTA value, so Wimbledon and Roland Garros men landed at
 * best-of-3; ATP-only events kept the /atp value and landed at best-of-5.
 *
 * best_of never reaches the Elo builder — grep build-ratings.mjs — so this is a
 * display repair, not a model change. Ratings are unaffected either way.
 *
 * Idempotent: rerunning after --apply reports zero changes. Line order and
 * every other field are preserved.
 */

const APPLY = process.argv.includes("--apply");
const LOG = "data/results.ndjson";

function main() {
  console.log(APPLY ? "MODE: APPLY (rewrites the log)" : "MODE: DRY RUN (no writes)");

  const raw = readFileSync(LOG, "utf8");
  const lines = raw.split("\n");
  const out: string[] = [];
  let parsed = 0;
  let changed = 0;
  const moves = new Map<string, number>();

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    let rec: MatchRecord;
    try {
      rec = JSON.parse(t);
    } catch {
      out.push(line); // never drop a line we cannot read
      continue;
    }
    parsed++;

    const want = bestOf(rec.tour, rec.tournament);
    if (rec.best_of === want) {
      out.push(line);
      continue;
    }

    changed++;
    const key = `${rec.tour} ${rec.best_of}->${want}`;
    moves.set(key, (moves.get(key) ?? 0) + 1);
    out.push(JSON.stringify({ ...rec, best_of: want }));
  }

  console.log(`\nparsed ${parsed} rows, ${changed} need correcting`);
  for (const [k, v] of [...moves].sort()) console.log(`  ${v.toString().padStart(4)}  ${k}`);

  if (out.length !== lines.length) {
    console.error(`\nFAIL: ${lines.length} lines in, ${out.length} out — refusing to write.`);
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\ndry run — nothing written");
    return;
  }

  writeFileSync(LOG, out.join("\n"));
  console.log(`\n✓ rewrote ${LOG} (${out.length} lines)`);
}

main();
