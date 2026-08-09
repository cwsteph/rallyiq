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
