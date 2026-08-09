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
 *
 * This is the only place fuzzy name matching happens. Everything downstream
 * joins on espn_id.
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
 *
 * player_id never changes for the pre-ESPN 1,575: Bet.playerExternalId is a
 * loose string with no foreign key, so reassigning ids orphans bets silently.
 */
export function resolvePlayerId(map: Record<string, string>, espn_id: string): string {
  return map[espn_id] ?? `espn_${espn_id}`;
}

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
