import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeHealth, evaluateHealth, type Health } from "./health.ts";

const AT = "2026-08-09T12:00:00.000Z";
const hoursBefore = (h: number) =>
  new Date(Date.parse(AT) - h * 3600_000).toISOString();

const health = (feeds: Health["feeds"]): Health => ({
  app: "rallyiq",
  generated: AT,
  feeds,
});

test("writeHealth records a feed's record count and timestamp", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "health-"));
  const p = path.join(dir, "health.json");
  writeHealth(p, "rallyiq", { ratings: { records: 1647, maxAgeHours: 72 } }, AT);

  const written = JSON.parse(readFileSync(p, "utf8"));
  assert.equal(written.app, "rallyiq");
  assert.equal(written.generated, AT);
  assert.equal(written.feeds.ratings.records, 1647);
  assert.equal(written.feeds.ratings.lastSuccess, AT);
  assert.equal(written.feeds.ratings.maxAgeHours, 72);
});

test("writeHealth preserves feeds it was not asked to update", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "health-"));
  const p = path.join(dir, "health.json");
  writeHealth(p, "rallyiq", { ratings: { records: 1647, maxAgeHours: 72 } }, AT);
  writeHealth(p, "rallyiq", { slate: { records: 12, maxAgeHours: 36 } }, AT);

  const written = JSON.parse(readFileSync(p, "utf8"));
  assert.equal(written.feeds.ratings.records, 1647, "the earlier feed must survive");
  assert.equal(written.feeds.slate.records, 12);
});

test("writeHealth refuses to record a zero-record feed", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "health-"));
  const p = path.join(dir, "health.json");
  assert.throws(
    () => writeHealth(p, "rallyiq", { ratings: { records: 0, maxAgeHours: 72 } }, AT),
    /zero records/i,
    "an empty feed is a failure, not a health update",
  );
});

test("a fresh feed is ok", () => {
  const h = health({ ratings: { lastSuccess: hoursBefore(2), records: 1647, maxAgeHours: 72 } });
  const out = evaluateHealth(h, AT);
  assert.equal(out.feeds.ratings.status, "ok");
  assert.equal(out.worst, "ok");
  assert.equal(out.suppressSignals, false);
});

test("past maxAgeHours a feed is stale", () => {
  const h = health({ ratings: { lastSuccess: hoursBefore(80), records: 1647, maxAgeHours: 72 } });
  const out = evaluateHealth(h, AT);
  assert.equal(out.feeds.ratings.status, "stale");
  assert.equal(out.worst, "stale");
  assert.equal(out.suppressSignals, false, "one missed run must not kill the signals");
});

test("at exactly maxAgeHours a feed is still ok — the threshold is a tolerance", () => {
  const h = health({ ratings: { lastSuccess: hoursBefore(72), records: 1647, maxAgeHours: 72 } });
  assert.equal(evaluateHealth(h, AT).feeds.ratings.status, "ok");
});

test("past double the threshold signals are suppressed", () => {
  const h = health({ ratings: { lastSuccess: hoursBefore(145), records: 1647, maxAgeHours: 72 } });
  const out = evaluateHealth(h, AT);
  assert.equal(out.feeds.ratings.status, "dead");
  assert.equal(out.worst, "dead");
  assert.equal(out.suppressSignals, true, "never price an edge off dead data");
});

test("the worst feed decides the overall status", () => {
  const h = health({
    ratings: { lastSuccess: hoursBefore(1), records: 1647, maxAgeHours: 72 },
    slate: { lastSuccess: hoursBefore(200), records: 12, maxAgeHours: 36 },
  });
  const out = evaluateHealth(h, AT);
  assert.equal(out.feeds.ratings.status, "ok");
  assert.equal(out.feeds.slate.status, "dead");
  assert.equal(out.worst, "dead");
  assert.equal(out.suppressSignals, true);
});

test("a missing health file reads as dead, never as healthy", () => {
  const out = evaluateHealth(null, AT);
  assert.equal(out.worst, "dead");
  assert.equal(out.suppressSignals, true);
  assert.match(out.message, /no health/i);
});

test("a malformed timestamp reads as dead rather than being ignored", () => {
  const h = health({ ratings: { lastSuccess: "not a date", records: 1647, maxAgeHours: 72 } });
  const out = evaluateHealth(h, AT);
  assert.equal(out.feeds.ratings.status, "dead");
  assert.equal(out.suppressSignals, true);
});

test("the message names the oldest feed and its age", () => {
  const h = health({ ratings: { lastSuccess: hoursBefore(80), records: 1647, maxAgeHours: 72 } });
  const out = evaluateHealth(h, AT);
  assert.match(out.message, /ratings/);
  assert.match(out.message, /2026-08-06/, "should surface the as-of date");
});
