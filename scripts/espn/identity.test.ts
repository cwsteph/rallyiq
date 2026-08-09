import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIdentityMap, resolvePlayerId, playerIdForToday, type Rating } from "./identity.ts";
import type { RankingEntry } from "./types.ts";

const RATINGS: Rating[] = [
  { player_id: "206173", name: "Jannik Sinner", tour: "ATP" },
  { player_id: "126205", name: "Tommy Paul", tour: "ATP" },
  { player_id: "polona_hercog", name: "Polona Hercog", tour: "WTA" },
];

const RANKINGS: RankingEntry[] = [
  { espn_id: "3623", name: "Jannik Sinner", rank: 1, points: 13450, tour: "ATP" },
  { espn_id: "4879", name: "Tommy Paul", rank: 12, points: 2100, tour: "ATP" },
];

test("maps espn ids onto existing sackmann player ids", () => {
  const { map } = buildIdentityMap(RATINGS, RANKINGS, []);
  assert.equal(map["3623"], "206173");
  assert.equal(map["4879"], "126205");
});

test("matching ignores case, accents and punctuation", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "999", name: "Stan Wawrinka", tour: "ATP" }],
    [{ espn_id: "111", name: "STAN  WAWRINKA", rank: 40, points: 900, tour: "ATP" }],
    [],
  );
  assert.equal(map["111"], "999");
});

test("resolves a player previously stuck on a slug id", () => {
  const { map } = buildIdentityMap(RATINGS, RANKINGS, [
    { espn_id: "555", name: "Polona Hercog", tour: "WTA" },
  ]);
  assert.equal(map["555"], "polona_hercog", "existing player_id must be preserved, not replaced");
});

test("a player espn knows but ratings does not gets an espn_ prefixed id", () => {
  const { map } = buildIdentityMap(RATINGS, RANKINGS, [
    { espn_id: "777", name: "Some Newcomer", tour: "ATP" },
  ]);
  assert.equal(resolvePlayerId(map, "777"), "espn_777");
});

test("names that resolve to nobody are reported", () => {
  const { unmatched } = buildIdentityMap(RATINGS, RANKINGS, [
    { espn_id: "777", name: "Some Newcomer", tour: "ATP" },
  ]);
  assert.deepEqual(unmatched, ["Some Newcomer"]);
});

test("matches across a swapped name order — ESPN writes chinese names surname-first", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "220000", name: "Qinwen Zheng", tour: "WTA" }],
    [],
    [{ espn_id: "6048", name: "Zheng Qinwen", tour: "WTA" }],
  );
  assert.equal(map["6048"], "220000");
});

test("matches when one source carries an extra surname", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "220001", name: "Daniel Merida Aguilar", tour: "ATP" }],
    [],
    [{ espn_id: "10239", name: "Daniel Merida", tour: "ATP" }],
  );
  assert.equal(map["10239"], "220001");
});

test("a token-subset match that fits two players is refused", () => {
  const { map, unmatched } = buildIdentityMap(
    [
      { player_id: "1", name: "Daniel Merida Aguilar", tour: "ATP" },
      { player_id: "2", name: "Daniel Merida Sanchez", tour: "ATP" },
    ],
    [],
    [{ espn_id: "10239", name: "Daniel Merida", tour: "ATP" }],
  );
  assert.equal(map["10239"], undefined);
  assert.deepEqual(unmatched, ["Daniel Merida"]);
});

test("a single shared token is not enough to match", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "1", name: "Novak Djokovic", tour: "ATP" }],
    [],
    [{ espn_id: "999", name: "Novak", tour: "ATP" }],
  );
  assert.equal(map["999"], undefined);
});

test("an exact match wins over a looser one", () => {
  const { map } = buildIdentityMap(
    [
      { player_id: "exact", name: "Daniel Merida", tour: "ATP" },
      { player_id: "loose", name: "Daniel Merida Aguilar", tour: "ATP" },
    ],
    [],
    [{ espn_id: "10239", name: "Daniel Merida", tour: "ATP" }],
  );
  assert.equal(map["10239"], "exact");
});

test("a name matching two different players is left unmatched rather than guessed", () => {
  const { map, unmatched } = buildIdentityMap(
    [
      { player_id: "1", name: "Alex Molcan", tour: "ATP" },
      { player_id: "2", name: "Alex Molcan", tour: "ATP" },
    ],
    [{ espn_id: "888", name: "Alex Molcan", rank: 90, points: 600, tour: "ATP" }],
    [],
  );
  assert.equal(map["888"], undefined);
  assert.deepEqual(unmatched, ["Alex Molcan"]);
});

test("cross-tour name collisions do not match", () => {
  const { map } = buildIdentityMap(
    [{ player_id: "1", name: "Jan Novak", tour: "ATP" }],
    [{ espn_id: "888", name: "Jan Novak", rank: 90, points: 600, tour: "WTA" }],
    [],
  );
  assert.equal(map["888"], undefined);
});

test("resolvePlayerId falls back to the espn_ form", () => {
  assert.equal(resolvePlayerId({ "3623": "206173" }, "3623"), "206173");
  assert.equal(resolvePlayerId({}, "9999"), "espn_9999");
});

test("a resolvable name uses its existing player_id", () => {
  const unresolved: string[] = [];
  const id = playerIdForToday(new Map([["janniksinner", "206173"]]), "3623", "Jannik Sinner", unresolved);
  assert.equal(id, "206173");
  assert.deepEqual(unresolved, []);
});

test("an unresolvable name gets an espn id and is recorded, never slugified", () => {
  const unresolved: string[] = [];
  const id = playerIdForToday(new Map(), "555", "Teodora Kostovic", unresolved);
  assert.equal(id, "espn_555");
  assert.notEqual(id, "teodora_kostovic");
  assert.deepEqual(unresolved, ["Teodora Kostovic"]);
});
