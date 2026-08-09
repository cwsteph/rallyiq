import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type FeedStatus = "ok" | "stale" | "dead";

export interface Feed {
  lastSuccess: string;
  records: number;
  maxAgeHours: number;
  status?: FeedStatus;
}

export interface Health {
  app: string;
  generated: string;
  feeds: Record<string, Feed>;
}

export interface Evaluated {
  worst: FeedStatus;
  suppressSignals: boolean;
  message: string;
  feeds: Record<string, Feed & { status: FeedStatus; ageHours: number }>;
}

/**
 * Records a successful feed run.
 *
 * Writing is itself an assertion: a feed that produced no records throws rather
 * than stamping a fresh timestamp. Recording success for an empty fetch is
 * exactly the lie that let six green workflow runs hide ten weeks of stale data.
 */
export function writeHealth(
  path: string,
  app: string,
  feeds: Record<string, { records: number; maxAgeHours: number }>,
  now: string = new Date().toISOString(),
): Health {
  for (const [name, f] of Object.entries(feeds)) {
    if (!f.records || f.records <= 0) {
      throw new Error(`feed "${name}" reported zero records — refusing to write health`);
    }
  }

  const existing: Health = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : { app, generated: now, feeds: {} };

  const merged: Health = {
    app,
    generated: now,
    feeds: { ...existing.feeds },
  };

  for (const [name, f] of Object.entries(feeds)) {
    merged.feeds[name] = {
      lastSuccess: now,
      records: f.records,
      maxAgeHours: f.maxAgeHours,
      status: "ok",
    };
  }

  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n");
  return merged;
}

/**
 * Pure. Staleness is a function of *now*, so status is recomputed on read
 * rather than trusted from the file — a file written a month ago still claims
 * every feed was "ok" at the time.
 *
 * Two stages: past the threshold the app says "data as of <date>"; past double
 * it, the app stops emitting BET/LEAN rather than pricing edges off dead data.
 */
export function evaluateHealth(health: Health | null, now: string = new Date().toISOString()): Evaluated {
  if (!health || !health.feeds || Object.keys(health.feeds).length === 0) {
    return {
      worst: "dead",
      suppressSignals: true,
      message: "No health data published — treating the feed as dead.",
      feeds: {},
    };
  }

  const nowMs = Date.parse(now);
  const rank: Record<FeedStatus, number> = { ok: 0, stale: 1, dead: 2 };

  const feeds: Evaluated["feeds"] = {};
  let worst: FeedStatus = "ok";
  let oldest: { name: string; ageHours: number; asOf: string } | null = null;

  for (const [name, f] of Object.entries(health.feeds)) {
    const ts = Date.parse(f.lastSuccess);
    // An unparseable timestamp is treated as dead, never skipped. Skipping it
    // would let a corrupt field read as healthy.
    const ageHours = Number.isNaN(ts) ? Infinity : (nowMs - ts) / 3600_000;

    let status: FeedStatus = "ok";
    if (ageHours > f.maxAgeHours * 2) status = "dead";
    else if (ageHours > f.maxAgeHours) status = "stale";

    feeds[name] = { ...f, status, ageHours };
    if (rank[status] > rank[worst]) worst = status;
    if (!oldest || ageHours > oldest.ageHours) {
      oldest = {
        name,
        ageHours,
        asOf: Number.isNaN(ts) ? "unknown" : f.lastSuccess.slice(0, 10),
      };
    }
  }

  const suppressSignals = worst === "dead";
  let message = "All feeds current.";
  if (worst === "stale") {
    message = `Data as of ${oldest!.asOf} — the ${oldest!.name} feed has not refreshed in ${Math.floor(oldest!.ageHours)}h.`;
  } else if (worst === "dead") {
    message = `Data as of ${oldest!.asOf} — the ${oldest!.name} feed is well past its refresh window. Signals are suppressed.`;
  }

  return { worst, suppressSignals, message, feeds };
}

/** Convenience for the app: read the published file, or null if absent/corrupt. */
export function readHealth(path: string): Health | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
