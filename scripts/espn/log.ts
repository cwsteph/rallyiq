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
 * Last date covered by the committed CSVs, per tour. ESPN returns whole
 * tournaments, so a fetch starting 2026-05-18 still hands back matches played
 * on the 17th — which the CSVs already contain. Feeding both to the builder
 * would count those matches twice in Elo.
 */
export const CSV_CUTOFF: Record<string, string> = {
  ATP: "2026-05-17",
  WTA: "2026-05-18",
};

/** Drop log rows the committed CSVs already cover. */
export function afterBase(records: MatchRecord[]): MatchRecord[] {
  return records.filter((m) => m.date > (CSV_CUTOFF[m.tour] ?? "0000-00-00"));
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
