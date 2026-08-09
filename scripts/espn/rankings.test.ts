import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRankings } from "./rankings.ts";

const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${n}.json`, import.meta.url), "utf8"));

test("parses the ranking list", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  assert.ok(rows.length >= 100, `expected 100+ entries, got ${rows.length}`);
  assert.ok(rows.length <= 150, "espn caps at 150 per tour");
});

test("the anchor player resolves — this is the payload-shape canary", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  const sinner = rows.find((r) => r.espn_id === "3623");
  assert.ok(sinner, "Sinner must resolve to espn_id 3623");
  assert.ok(sinner.rank >= 1 && sinner.rank <= 5, `unexpected rank ${sinner.rank}`);
  assert.ok(sinner.points > 0);
});

test("every entry carries an id, a name and a tour", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  for (const r of rows) {
    assert.ok(r.espn_id, "missing espn_id");
    assert.ok(r.name, "missing name");
    assert.equal(r.tour, "ATP");
  }
});

test("ranks are unique", () => {
  const rows = parseRankings(fixture("rankings-atp"), "ATP");
  const ranks = rows.map((r) => r.rank);
  assert.equal(new Set(ranks).size, ranks.length);
});

test("malformed input yields an empty list", () => {
  assert.deepEqual(parseRankings(null, "ATP"), []);
  assert.deepEqual(parseRankings({}, "ATP"), []);
  assert.deepEqual(parseRankings({ rankings: [] }, "ATP"), []);
});
