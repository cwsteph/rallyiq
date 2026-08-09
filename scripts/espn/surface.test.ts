import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, buildSurfaceMap, resolveSurface } from "./surface.ts";

test("normalizeName strips case, accents and punctuation", () => {
  assert.equal(normalizeName("Trophée Clarins"), "tropheeclarins");
  assert.equal(normalizeName("Monte-Carlo Masters"), "montecarlomasters");
  assert.equal(normalizeName("s-Hertogenbosch"), "shertogenbosch");
});

test("buildSurfaceMap reads every committed CSV", () => {
  const map = buildSurfaceMap("data", {});
  assert.ok(map.size > 500, `expected 500+ tournaments, got ${map.size}`);
  assert.equal(map.get("wimbledon"), "Grass");
  assert.equal(map.get("rolandgarros"), "Clay");
  assert.equal(map.get("indianwells"), "Hard");
});

test("overrides win over CSV entries", () => {
  const map = buildSurfaceMap("data", { wimbledon: "Carpet" });
  assert.equal(map.get("wimbledon"), "Carpet");
});

test("resolveSurface matches on the event name", () => {
  const map = new Map([["wimbledon", "Grass"]]);
  assert.equal(resolveSurface(map, "Wimbledon", "London, Great Britain"), "Grass");
});

test("resolveSurface falls back to the venue city", () => {
  const map = new Map([["bastad", "Clay"]]);
  assert.equal(resolveSurface(map, "Nordea Open", "Båstad, Sweden"), "Clay");
});

test("resolveSurface returns null rather than guessing", () => {
  const map = new Map([["wimbledon", "Grass"]]);
  assert.equal(resolveSurface(map, "Some 125 Event", "Contrexeville, France"), null);
});

test("resolveSurface tolerates a missing venue", () => {
  const map = new Map([["wimbledon", "Grass"]]);
  assert.equal(resolveSurface(map, "Wimbledon", ""), "Grass");
  assert.equal(resolveSurface(map, "Unknown", ""), null);
});
