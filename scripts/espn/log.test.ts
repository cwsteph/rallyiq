import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLog, appendMatches, toCsvRows, afterBase, CSV_CUTOFF, unmatchedFromLog } from "./log.ts";
import type { MatchRecord } from "./types.ts";

const rec = (id: string, extra: Partial<MatchRecord> = {}): MatchRecord => ({
  competition_id: id,
  date: "2026-07-06",
  tournament: "Wimbledon",
  surface: "Grass",
  round: "R32",
  best_of: 5,
  tour: "ATP",
  winner_espn_id: "3623",
  winner_name: "Jannik Sinner",
  loser_espn_id: "13489",
  loser_name: "Ivan Ivanov",
  score: "6-2 6-2",
  ...extra,
});

const tmpLog = () => path.join(mkdtempSync(path.join(tmpdir(), "rallyiq-")), "results.ndjson");

test("reading a missing file yields an empty log", () => {
  assert.deepEqual(readLog(path.join(tmpdir(), "definitely-absent.ndjson")), []);
});

test("appends new records", () => {
  const p = tmpLog();
  const r = appendMatches(p, [rec("1"), rec("2")]);
  assert.deepEqual(r, { added: 2, skipped: 0 });
  assert.equal(readLog(p).length, 2);
});

test("appending the same competitions twice changes nothing", () => {
  const p = tmpLog();
  appendMatches(p, [rec("1"), rec("2")]);
  const second = appendMatches(p, [rec("1"), rec("2")]);
  assert.deepEqual(second, { added: 0, skipped: 2 });
  assert.equal(readLog(p).length, 2);
  assert.equal(readFileSync(p, "utf8").trim().split("\n").length, 2);
});

test("dedupes within a single batch", () => {
  const p = tmpLog();
  const r = appendMatches(p, [rec("1"), rec("1"), rec("3")]);
  assert.deepEqual(r, { added: 2, skipped: 1 });
});

test("survives a trailing newline and blank lines", () => {
  const p = tmpLog();
  writeFileSync(p, JSON.stringify(rec("1")) + "\n\n");
  assert.equal(readLog(p).length, 1);
  assert.deepEqual(appendMatches(p, [rec("1")]), { added: 0, skipped: 1 });
});

test("toCsvRows emits the columns build-ratings reads", () => {
  const [row] = toCsvRows([rec("1")]) as any[];
  assert.equal(row.tourney_date, "20260706");
  assert.equal(row.surface, "Grass");
  assert.equal(row.winner_name, "Jannik Sinner");
  assert.equal(row.loser_name, "Ivan Ivanov");
  assert.equal(row.score, "6-2 6-2");
  assert.equal(row.round, "R32");
  for (const col of ["w_svpt", "w_1stWon", "w_2ndWon", "l_svpt"]) {
    assert.equal(row[col], "", `${col} must be empty — espn has no serve stats`);
  }
});

test("toCsvRows drops matches with no surface", () => {
  assert.equal(toCsvRows([rec("1", { surface: null })]).length, 0);
});

test("afterBase drops rows the committed csvs already cover", () => {
  const kept = afterBase([
    rec("a", { tour: "ATP", date: "2026-05-16" }),
    rec("b", { tour: "ATP", date: "2026-05-17" }),
    rec("c", { tour: "ATP", date: "2026-05-18" }),
  ]);
  assert.deepEqual(kept.map((m) => m.competition_id), ["c"]);
});

test("afterBase uses a per-tour cutoff — the wta csv runs a day longer", () => {
  assert.equal(CSV_CUTOFF.ATP, "2026-05-17");
  assert.equal(CSV_CUTOFF.WTA, "2026-05-18");
  const kept = afterBase([
    rec("atp", { tour: "ATP", date: "2026-05-18" }),
    rec("wta", { tour: "WTA", date: "2026-05-18" }),
  ]);
  assert.deepEqual(kept.map((m) => m.competition_id), ["atp"]);
});

// ── unmatched surfaces ───────────────────────────────────────────
//
// toCsvRows drops null-surface rows before the builder sees them. That drop is
// correct — the committed CSVs are main-tour only, so the Challenger and 125
// events ESPN returns have no surface to resolve against, and inventing one
// would feed Elo a category its history never contained. What was wrong is the
// record of it: the file was overwritten each run with only that window's
// misses, so it listed 4 tournaments while the log was dropping 10.

const nulled = (tournament: string, id: string): MatchRecord => ({
  competition_id: id,
  date: "2026-08-01",
  tournament,
  surface: null,
  round: "Round 1",
  best_of: 3,
  tour: "ATP",
  winner_espn_id: "1",
  winner_name: "A",
  loser_espn_id: "2",
  loser_name: "B",
  score: "6-0 6-0",
});

test("unmatchedFromLog reports every tournament the log actually drops", () => {
  const log = [
    nulled("Odlum Brown VanOpen", "1"),
    nulled("Odlum Brown VanOpen", "2"),
    nulled("The Memphis Classic", "3"),
    { ...nulled("US Open", "4"), surface: "Hard" },
  ];
  assert.deepEqual(unmatchedFromLog(log, []), {
    tournaments: ["Odlum Brown VanOpen", "The Memphis Classic"],
    droppedRows: 3,
  });
});

test("unmatchedFromLog folds in events seen this run but already logged", () => {
  const log = [nulled("The Memphis Classic", "1")];
  assert.deepEqual(unmatchedFromLog(log, ["Kia Open", "The Memphis Classic"]), {
    tournaments: ["Kia Open", "The Memphis Classic"],
    droppedRows: 1,
  });
});

test("unmatchedFromLog is self-correcting once a surface resolves", () => {
  // No prior-file union: a tournament that gains an override stops being listed
  // instead of lingering as a permanent accusation.
  assert.deepEqual(unmatchedFromLog([{ ...nulled("Kia Open", "1"), surface: "Hard" }], []), {
    tournaments: [],
    droppedRows: 0,
  });
});
