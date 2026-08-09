import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLog, appendMatches, toCsvRows } from "./log.ts";
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
