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
