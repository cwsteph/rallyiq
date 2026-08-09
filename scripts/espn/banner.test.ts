import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateHealth } from "../../src/lib/health.ts";

/**
 * The banner renders whatever evaluateHealth returns, so testing the pure
 * function is testing the banner's behaviour.
 */
const evaluate = (nowMs: number, health: any) => evaluateHealth(health, nowMs);

const NOW = Date.parse("2026-08-09T12:00:00.000Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const withFeed = (h: number, maxAgeHours = 36) => ({
  app: "rallyiq",
  generated: ago(h),
  feeds: { slate: { lastSuccess: ago(h), records: 12, maxAgeHours } },
});

test("a current feed renders no banner", () => {
  const v = evaluate(NOW, withFeed(2));
  assert.equal(v.worst, "ok");
  assert.equal(v.message, "");
  assert.equal(v.suppressSignals, false);
});

test("past the threshold the banner states the as-of date", () => {
  const v = evaluate(NOW, withFeed(40));
  assert.equal(v.worst, "stale");
  assert.match(v.message, /Data as of 2026-08-07/);
  assert.match(v.message, /slate/);
  assert.equal(v.suppressSignals, false, "one missed run must not kill the signals");
});

test("past double the threshold signals are suppressed", () => {
  const v = evaluate(NOW, withFeed(80));
  assert.equal(v.worst, "dead");
  assert.equal(v.suppressSignals, true);
  assert.match(v.message, /unpriced/i);
});

test("a missing health file reads as dead, not as healthy", () => {
  const v = evaluate(NOW, null);
  assert.equal(v.worst, "dead");
  assert.equal(v.suppressSignals, true);
  assert.match(v.message, /not reported in/i);
});

test("an empty feeds object reads as dead", () => {
  const v = evaluate(NOW, { app: "rallyiq", generated: ago(1), feeds: {} });
  assert.equal(v.worst, "dead");
});

test("a corrupt timestamp reads as dead rather than being skipped", () => {
  const v = evaluate(NOW, {
    app: "rallyiq",
    generated: ago(1),
    feeds: { slate: { lastSuccess: "garbage", records: 12, maxAgeHours: 36 } },
  });
  assert.equal(v.worst, "dead");
  assert.equal(v.suppressSignals, true);
});

test("the worst feed decides, even beside a healthy one", () => {
  const v = evaluate(NOW, {
    app: "rallyiq",
    generated: ago(1),
    feeds: {
      ratings: { lastSuccess: ago(1), records: 1647, maxAgeHours: 72 },
      slate: { lastSuccess: ago(200), records: 12, maxAgeHours: 36 },
    },
  });
  assert.equal(v.worst, "dead");
  assert.match(v.message, /slate/);
});

test("the live health file this repo publishes is currently healthy", () => {
  const live = JSON.parse(readFileSync("data/health.json", "utf8"));
  const v = evaluate(Date.parse(live.generated) + 60_000, live);
  assert.equal(v.worst, "ok", `live health is not ok: ${v.message}`);
});
