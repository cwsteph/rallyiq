import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * Invariants over the committed data/search-index.json.
 *
 * These are the checks that caught real merges going wrong while the index was
 * being built: "Boss Open" folded into Stuttgart's April clay event, and "MSC
 * Hamburg Ladies Open" folded into May's ATP Hamburg. Both looked fine as slugs
 * and only showed up as a tournament claiming two surfaces over two months.
 */

const PATH = "data/search-index.json";
const index = existsSync(PATH) ? JSON.parse(readFileSync(PATH, "utf8")) : null;
const skip = index ? false : "data/search-index.json not built — run node scripts/season-index.ts";

const DAY = 86_400_000;
const TEAM = new Set(["davis-cup", "bjk-cup"]);

test("the index covers a plausible season", { skip }, () => {
  assert.equal(index.season, 2026);
  assert.ok(index.tournaments.length >= 40, `only ${index.tournaments.length} tournaments`);
  assert.ok(index.players.length >= 1500, `only ${index.players.length} players`);
  assert.ok(index.results.length >= 3000, `only ${index.results.length} results`);
});

test("no two tournaments share a slug", { skip }, () => {
  const seen = new Set<string>();
  for (const t of index.tournaments) {
    assert.ok(!seen.has(t.slug), `duplicate slug ${t.slug}`);
    seen.add(t.slug);
  }
});

test("every result points at a tournament and two known players", { skip }, () => {
  const slugs = new Set(index.tournaments.map((t: any) => t.slug));
  const players = new Set(index.players.map((p: any) => p.id));
  for (const r of index.results) {
    assert.ok(slugs.has(r.s), `result references unknown tournament ${r.s}`);
    assert.ok(players.has(r.w), `unknown winner ${r.w}`);
    assert.ok(players.has(r.l), `unknown loser ${r.l}`);
    assert.notEqual(r.w, r.l);
  }
});

test("no tournament is two tournaments wearing one slug", { skip }, () => {
  // A single event runs a fortnight at most and is played on one surface.
  // Team ties are exempt: Davis Cup and BJK Cup are hosted worldwide on
  // whatever the home nation uses, and collapsing their ties is the point.
  const rows = new Map<string, { dates: string[]; surfaces: Set<string> }>();
  const surfaceOf = new Map(index.tournaments.map((t: any) => [t.slug, t.surface]));
  for (const r of index.results) {
    let e = rows.get(r.s);
    if (!e) {
      e = { dates: [], surfaces: new Set() };
      rows.set(r.s, e);
    }
    e.dates.push(r.d);
    const s = surfaceOf.get(r.s);
    if (s) e.surfaces.add(s as string);
  }
  for (const [slug, e] of rows) {
    if (TEAM.has(slug)) continue;
    const sorted = e.dates.slice().sort();
    const span = (Date.parse(sorted[sorted.length - 1]) - Date.parse(sorted[0])) / DAY;
    assert.ok(span <= 25, `${slug} spans ${Math.round(span)} days — two events sharing a slug?`);
  }
});

test("the cutoff straddlers appear exactly once each", { skip }, () => {
  // Geneva, Hamburg, Strasbourg and Rabat are in both the CSVs (under a short
  // name) and the ESPN log (under a sponsored one). If canonicalisation breaks,
  // each silently becomes two tournaments instead of failing.
  for (const slug of ["geneva", "hamburg", "strasbourg", "rabat"]) {
    const hits = index.tournaments.filter((t: any) => t.slug === slug);
    assert.equal(hits.length, 1, `${slug} appears ${hits.length} times`);
    assert.ok(hits[0].matches > 20, `${slug} has only ${hits[0].matches} matches`);
  }
});

test("the slams are present, on the right surface, with five-set men's draws", { skip }, () => {
  const expect: Record<string, string> = {
    "australian-open": "Hard",
    "roland-garros": "Clay",
    wimbledon: "Grass",
    "us-open": "Hard",
  };
  for (const [slug, surface] of Object.entries(expect)) {
    const t = index.tournaments.find((x: any) => x.slug === slug);
    assert.ok(t, `${slug} missing`);
    assert.equal(t.surface, surface);
    const men = index.results.filter((r: any) => r.s === slug && r.w.startsWith("atp-"));
    assert.ok(men.length > 0, `${slug} has no men's results`);
    for (const r of men) assert.equal(r.b, 5, `${slug} men's match recorded as best of ${r.b}`);
  }
});

test("player ids are tour-qualified and unique", { skip }, () => {
  const seen = new Set<string>();
  for (const p of index.players) {
    assert.match(p.id, /^(atp|wta)-/, `${p.id} is not tour-qualified`);
    assert.ok(!seen.has(p.id), `duplicate player id ${p.id}`);
    seen.add(p.id);
  }
  // The five ids Sackmann shares across tours must survive as distinct rows.
  const bare = index.players.map((p: any) => p.player_id);
  const dupes = bare.filter((v: string, i: number) => bare.indexOf(v) !== i);
  assert.ok(dupes.length >= 1, "expected at least one player_id shared across tours");
});
