import { resolveSurface } from "./surface.ts";
import type { MatchRecord } from "./types.ts";

const SINGLES = new Set(["mens-singles", "womens-singles"]);

/**
 * ESPN bundles qualifying into the same event as the main draw — 112 of
 * Wimbledon 2026's 239 men's singles competitions are qualifying rounds. The
 * committed CSVs are main-tour only (Sackmann keeps qualifying in separate
 * qual_chall files the builder never downloaded), so ingesting qualifying
 * would feed the Elo model a category of match its history has never seen.
 */
export function isQualifying(round: string): boolean {
  return /qualif/i.test(round);
}

/** ESPN gives competitor.id directly; the playercard href is the fallback. */
export function competitorId(c: unknown): string | null {
  if (!c || typeof c !== "object") return null;
  const comp = c as Record<string, any>;
  if (comp.id) return String(comp.id);

  const href = (comp.athlete?.links || []).find((l: any) => l.rel?.includes("playercard"))?.href;
  const m = typeof href === "string" ? href.match(/\/player\/_\/id\/(\d+)/) : null;
  return m ? m[1] : null;
}

/** Set scores as "6-2 6-2", winner's games first. */
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
 * Pure: an ESPN scoreboard payload in, completed main-draw singles matches out.
 *
 * `?dates=` returns entire tournaments rather than a single day, so a caller
 * walking a date range will see the same competition many times. Dedupe on
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

        const round = comp.round?.displayName || comp.round?.name || "";
        if (isQualifying(round)) continue;

        const cs = comp.competitors || [];
        const winner = cs.find((c: any) => c.winner === true);
        const loser = cs.find((c: any) => c.winner === false);
        if (!winner || !loser) continue;

        const wId = competitorId(winner);
        const lId = competitorId(loser);
        if (!wId || !lId || wId === lId) continue;

        const winnerName = winner.athlete?.displayName || "";
        const loserName = loser.athlete?.displayName || "";
        if (!winnerName || !loserName) continue;

        seen.add(String(comp.id));
        matches.push({
          competition_id: String(comp.id),
          date: String(comp.date).slice(0, 10),
          tournament,
          surface,
          round,
          best_of: comp.format?.regulation?.periods === 5 ? 5 : 3,
          tour,
          winner_espn_id: wId,
          winner_name: winnerName,
          loser_espn_id: lId,
          loser_name: loserName,
          score: scoreOf(winner, loser),
        });
      }
    }
  }

  return { matches, unknownSurfaces: [...unknown] };
}
