import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseScoreboard, competitorId, isQualifying } from "./parse.ts";

const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${n}.json`, import.meta.url), "utf8"));

const SURFACES = new Map([
  ["wimbledon", "Grass"],
  ["usopen", "Hard"],
  ["generaliopen", "Clay"],
]);

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

// ── best_of ────────────────────────────────────────────────────────────────
//
// `format.regulation.periods` describes the *endpoint*, not the match. The two
// US Open fixtures are the same competitions pulled from /atp and /wta; the
// only fields that differ are the league uid (l:851 vs l:900) and `periods`
// (5 vs 3). Reading it as a match property made Wimbledon men best-of-3 and
// Kitzbuhel first rounds best-of-5 — 563 rows in the committed log.

test("an ATP 250 is best-of-3 even though /atp reports periods: 5", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-kitzbuhel-2026"), SURFACES);
  assert.ok(matches.length > 0, "fixture should hold main-draw singles");
  for (const m of matches) {
    assert.equal(m.tour, "ATP");
    assert.equal(m.best_of, 3, `${m.tournament} is not a slam`);
  }
});

test("women's singles is best-of-3 when parsed from the /atp payload", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-usopen-atp"), SURFACES);
  const wta = matches.filter((m) => m.tour === "WTA");
  assert.ok(wta.length > 0, "the /atp payload carries the women's draw too");
  for (const m of wta) assert.equal(m.best_of, 3);
});

test("men's singles is best-of-5 at a slam when parsed from the /wta payload", () => {
  const { matches } = parseScoreboard(fixture("scoreboard-usopen-wta"), SURFACES);
  const atp = matches.filter((m) => m.tour === "ATP");
  assert.ok(atp.length > 0, "the /wta payload carries the men's draw too");
  for (const m of atp) assert.equal(m.best_of, 5);
});

test("the same competition parses identically from either endpoint", () => {
  // The property backfill.ts's last-write-wins map silently violated: whichever
  // endpoint was fetched second decided best_of for every combined event.
  const a = parseScoreboard(fixture("scoreboard-usopen-atp"), SURFACES).matches;
  const w = parseScoreboard(fixture("scoreboard-usopen-wta"), SURFACES).matches;
  const byId = new Map(w.map((m) => [m.competition_id, m]));

  let compared = 0;
  for (const m of a) {
    const other = byId.get(m.competition_id);
    if (!other) continue;
    compared++;
    assert.deepEqual(m, other, `competition ${m.competition_id} differs by endpoint`);
  }
  assert.ok(compared > 0, "the fixtures should share competitions");
});
