import { readFileSync, writeFileSync } from "node:fs";
import { buildSurfaceMap, normalizeName } from "./surface.ts";
import type { MatchRecord } from "./types.ts";

/**
 * Re-resolves the surface of already-logged matches against the current
 * surface map, so adding an entry to data/surface-overrides.json repairs the
 * history instead of only affecting future fetches.
 *
 * Only ever *corrects* a surface by name. It will not null one out: rows whose
 * surface came from resolveSurface's venue-city fallback have no name entry to
 * look up, and the log does not store the venue, so a name miss means "no
 * opinion", not "wrong".
 *
 * Why this exists: resolveSurface falls back to the venue city when the event
 * name is unknown, and a city can host two events on two surfaces. Stuttgart
 * has the WTA Porsche Grand Prix on indoor clay in April and the ATP Boss Open
 * on grass in June; the CSV map only knows "Stuttgart -> Clay", so 27 grass
 * matches entered the Elo as clay. Surface feeds surface-specific Elo directly,
 * which makes this the one field where a wrong value is worse than none.
 */

const APPLY = process.argv.includes("--apply");
const LOG = "data/results.ndjson";

function main() {
  console.log(APPLY ? "MODE: APPLY (rewrites the log)" : "MODE: DRY RUN (no writes)");

  const surfaces = buildSurfaceMap(
    "data",
    JSON.parse(readFileSync("data/surface-overrides.json", "utf8")),
  );

  const lines = readFileSync(LOG, "utf8").split("\n");
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
      out.push(line);
      continue;
    }
    parsed++;

    const byName = surfaces.get(normalizeName(rec.tournament));
    if (!byName || byName === rec.surface) {
      out.push(line);
      continue;
    }

    changed++;
    const key = `${rec.tournament}: ${rec.surface ?? "null"} -> ${byName}`;
    moves.set(key, (moves.get(key) ?? 0) + 1);
    out.push(JSON.stringify({ ...rec, surface: byName }));
  }

  console.log(`\nparsed ${parsed} rows, ${changed} need correcting`);
  for (const [k, v] of [...moves].sort()) console.log(`  ${String(v).padStart(4)}  ${k}`);

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
