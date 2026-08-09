import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The 2026-06-02 ratings.json was built from the Sackmann CSVs alone. Rebuilding
 * from those same CSVs must reproduce it. If it does not, the repointed builder
 * has drifted and nothing it produces for the gap window can be trusted.
 *
 * Requires: `node scripts/build-ratings.mjs --base-only` to have run against the
 * committed baseline. Skips when no baseline is present.
 */
test("rebuilding from the csv base reproduces the 2026-06-02 ratings", (t) => {
  if (!existsSync("data/ratings.baseline.json")) {
    t.skip("no baseline captured");
    return;
  }
  // Build from the CSV base into a scratch file so the live ratings.json — which
  // legitimately includes the ESPN log — is never compared against, or clobbered.
  const scratch = path.join(mkdtempSync(path.join(tmpdir(), "rallyiq-cont-")), "ratings.json");
  execFileSync("node", ["scripts/build-ratings.mjs", "--base-only", "--out", scratch], {
    stdio: "ignore",
  });

  const baseline = JSON.parse(readFileSync("data/ratings.baseline.json", "utf8"));
  const rebuilt = JSON.parse(readFileSync(scratch, "utf8"));

  // Key on tour + player_id, not player_id alone. Sackmann's ATP and WTA id
  // spaces overlap — 211768 is both Naomi Osaka (WTA) and Manas Dhamne (ATP) —
  // so a player_id-only map silently collapses 5 pairs and invents drift.
  const key = (p: any) => `${p.tour}:${p.player_id}`;
  const byId = new Map(rebuilt.map((p: any) => [key(p), p]));
  assert.ok(
    rebuilt.length >= baseline.length - 5,
    `lost players: ${baseline.length} -> ${rebuilt.length}`,
  );

  const drifted: string[] = [];
  for (const b of baseline) {
    const r: any = byId.get(key(b));
    if (!r) continue;
    if (Math.abs(r.elo_overall - b.elo_overall) > 1.0) {
      drifted.push(`${b.name}: ${b.elo_overall} -> ${r.elo_overall}`);
    }
  }
  assert.deepEqual(drifted, [], `${drifted.length} players drifted more than 1 Elo point`);
});

/**
 * Guards the collision above. It is pre-existing and not fixed here: player_id
 * is what Bet.playerExternalId stores, so renumbering would orphan live bets.
 * The test exists so the count cannot grow unnoticed.
 */
test("cross-tour player_id collisions stay at the known 5", () => {
  const ratings = JSON.parse(readFileSync("data/ratings.json", "utf8"));
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const p of ratings) {
    const prev = seen.get(p.player_id);
    if (prev) collisions.push(`${p.player_id}: ${prev} / ${p.name}`);
    else seen.set(p.player_id, `${p.name} (${p.tour})`);
  }
  assert.equal(
    collisions.length,
    5,
    `cross-tour id collisions changed:\n${collisions.join("\n")}`,
  );
});
