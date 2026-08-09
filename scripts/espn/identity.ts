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
/** Name split into normalized word tokens, order-independent. */
function tokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((t) => normalizeName(t))
    .filter(Boolean);
}

/** Tokens sorted and rejoined — "Zheng Qinwen" and "Qinwen Zheng" collapse to one key. */
function sortedKey(name: string): string {
  return tokens(name).sort().join("");
}

/**
 * A reusable name matcher over a ratings roster. Returns the single matching
 * player_id, or null when nothing or more than one thing matches.
 */
export function createMatcher(ratings: Rating[]): (name: string, tour: string) => string | null {
  const byName = new Map<string, string[]>();
  const bySorted = new Map<string, string[]>();
  const roster: Array<{ tour: string; tokens: string[]; player_id: string }> = [];

  for (const r of ratings) {
    const exact = `${r.tour}|${normalizeName(r.name)}`;
    if (!byName.has(exact)) byName.set(exact, []);
    byName.get(exact)!.push(r.player_id);

    const sorted = `${r.tour}|${sortedKey(r.name)}`;
    if (!bySorted.has(sorted)) bySorted.set(sorted, []);
    bySorted.get(sorted)!.push(r.player_id);

    roster.push({ tour: r.tour, tokens: tokens(r.name), player_id: r.player_id });
  }

  return (name: string, tour: string): string | null => {
    const exact = byName.get(`${tour}|${normalizeName(name)}`) || [];
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;

    const sorted = bySorted.get(`${tour}|${sortedKey(name)}`) || [];
    if (sorted.length === 1) return sorted[0];
    if (sorted.length > 1) return null;

    const mine = tokens(name);
    if (mine.length >= 2) {
      const subset = roster.filter(
        (r) =>
          r.tour === tour &&
          r.tokens.length >= mine.length &&
          mine.every((t) => r.tokens.includes(t)),
      );
      if (subset.length === 1) return subset[0].player_id;
    }

    return null;
  };
}

export function buildIdentityMap(
  ratings: Rating[],
  rankings: RankingEntry[],
  observed: Array<{ espn_id: string; name: string; tour: "ATP" | "WTA" }>,
): { map: Record<string, string>; unmatched: string[] } {
  const match = createMatcher(ratings);

  const map: Record<string, string> = {};
  const unmatched: string[] = [];

  /**
   * Three tiers, each requiring exactly one candidate:
   *   1. the normalized name matches outright
   *   2. the same words in a different order — ESPN writes Chinese names
   *      surname-first ("Zheng Qinwen"), Sackmann writes "Qinwen Zheng"
   *   3. every word of the shorter name appears in the longer one, for
   *      dropped middle surnames ("Daniel Merida" / "Daniel Merida Aguilar")
   *
   * Two candidates at any tier means unmatched. A wrong join silently merges
   * two players' careers into one Elo, which is worse than a missing rating.
   */
  const consider = (espn_id: string, name: string, tour: string) => {
    if (map[espn_id]) return;
    const hit = match(name, tour);
    if (hit) map[espn_id] = hit;
    else unmatched.push(name);
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

/**
 * The resolver fetch-today.ts uses. Wraps createMatcher so an unresolved name
 * becomes espn_<id> and is recorded, never a slug.
 *
 * The path this replaces also matched on bare surname, so "Zverev" resolved to
 * whichever Zverev was indexed first — a silently wrong player, worse than the
 * slug it fell back to.
 */
export function createTodayResolver(ratings: Rating[]) {
  const match = createMatcher(ratings);
  const unresolved: string[] = [];

  return {
    resolve(name: string, tour: string, espn_id: string | null): string {
      const hit = match(name, tour);
      if (hit) return hit;
      unresolved.push(name);
      return espn_id ? `espn_${espn_id}` : `unresolved_${normalizeName(name)}`;
    },
    get unresolved() {
      return [...new Set(unresolved)];
    },
  };
}
