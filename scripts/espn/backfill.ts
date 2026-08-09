import { readFileSync, writeFileSync } from "node:fs";
import { buildSurfaceMap } from "./surface.ts";
import { parseScoreboard } from "./parse.ts";
import { appendMatches, readLog } from "./log.ts";
import type { MatchRecord } from "./types.ts";

const APPLY = process.argv.includes("--apply");
const fromArg = process.argv.indexOf("--from");
const FROM = fromArg > -1 ? process.argv[fromArg + 1] : "2026-05-18";
const minArg = process.argv.indexOf("--min");
const MIN_EXPECTED = minArg > -1 ? Number(process.argv[minArg + 1]) : 500;

const LOG = "data/results.ndjson";
const UNMATCHED = "data/unmatched.json";

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
      let added = 0;
      for (const m of matches) {
        if (!all.has(m.competition_id)) added++;
        all.set(m.competition_id, m);
      }
      for (const u of unknown) unknownSurfaces.add(u);
      console.log(`  ${tour} ${week}: ${matches.length} completed singles (${added} new)`);
    }
  }

  const records = [...all.values()].sort((a, b) => a.date.localeCompare(b.date));
  const noSurface = records.filter((r) => r.surface === null).length;

  console.log(`\ndistinct completed main-draw singles: ${records.length}`);
  console.log(`  without a resolved surface: ${noSurface}`);
  console.log(`  already in the log: ${readLog(LOG).length}`);
  if (unknownSurfaces.size) {
    console.log(`unresolved tournaments: ${[...unknownSurfaces].join(" | ")}`);
  }

  // The invariant: a run that produces nothing must fail rather than commit.
  if (records.length < MIN_EXPECTED) {
    console.error(`\nFAIL: expected at least ${MIN_EXPECTED} matches, got ${records.length}.`);
    console.error("Either the window is already covered or ESPN changed shape. Not writing.");
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\ndry run — nothing written");
    return;
  }

  const { added, skipped } = appendMatches(LOG, records);
  writeFileSync(UNMATCHED, JSON.stringify({ tournaments: [...unknownSurfaces] }, null, 1) + "\n");
  console.log(`\nappended: ${added}, already present: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
