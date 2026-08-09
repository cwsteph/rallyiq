import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseScoreboard, competitorId, isQualifying } from "./parse.ts";

const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${n}.json`, import.meta.url), "utf8"));

const SURFACES = new Map([["wimbledon", "Grass"]]);

test("competitorId prefers the direct id", () => {
  assert.equal(competitorId({ id: "13489", athlete: { links: [] } }), "13489");
});

test("competitorId falls back to the playercard link", () => {
  const c = {
    athlete: { links: [{ rel: ["playercard"], href: "https://www.espn.com/tennis/player/_/id/13489/ivan-ivanov" }] },
  };
  assert.equal(competitorId(c), "13489");
});

test("competitorId returns null when neither is present", () => {
  assert.equal(competitorId({ athlete: { links: [] } }), null);
  assert.equal(competitorId(null), null);
});

test("isQualifying catches every qualifying round label", () => {
  assert.equal(isQualifying("Qualifying 1st Round"), true);
  assert.equal(isQualifying("Qualifying 2nd Round"), true);
  assert.equal(isQualifying("Qualifying Final"), true);
  assert.equal(isQualifying("Round 1"), false);
  assert.equal(isQualifying("Final"), false);
  assert.equal(isQualifying(""), false);
});

test("parses completed main-draw singles matches", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  assert.equal(matches.length, 2, "expected the two main-draw singles only");
  for (const m of matches) {
    assert.equal(m.tournament, "Wimbledon");
    assert.equal(m.surface, "Grass");
    assert.equal(m.tour, "ATP");
    assert.ok(m.winner_espn_id, "winner needs an espn id");
    assert.ok(m.loser_espn_id, "loser needs an espn id");
    assert.notEqual(m.winner_espn_id, m.loser_espn_id);
    assert.ok(m.winner_name && m.loser_name, "both players need names");
    assert.match(m.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("excludes qualifying — the historical base has none", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  assert.equal(matches.find((m) => m.competition_id === "179877"), undefined);
  for (const m of matches) assert.equal(isQualifying(m.round), false);
});

test("excludes doubles and keeps competition ids unique", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  const ids = matches.map((m) => m.competition_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(matches.length, 2);
});

test("best_of is 5 for a men's slam and the score reads winner-first", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), SURFACES);
  assert.equal(matches[0].best_of, 5);
  assert.match(matches[0].score, /^\d+-\d+/);
  const [firstSet] = matches[0].score.split(" ");
  const [w, l] = firstSet.split("-").map(Number);
  assert.ok(w > l, `winner's first set should lead: ${firstSet}`);
});

test("an unknown surface yields null and is reported, not defaulted", () => {
  const { matches, unknownSurfaces } = parseScoreboard(fixture("scoreboard-wimbledon-2026"), new Map());
  assert.equal(matches[0].surface, null);
  assert.deepEqual(unknownSurfaces, ["Wimbledon"]);
});

test("returns nothing for an empty scoreboard", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-empty"), SURFACES);
  assert.deepEqual(matches, []);
});

test("returns nothing for malformed input", () => {
  assert.deepEqual(parseScoreboard(null, SURFACES).matches, []);
  assert.deepEqual(parseScoreboard({}, SURFACES).matches, []);
});
