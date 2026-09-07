import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalTournament, tournamentSlug } from "../../src/lib/search/slug.ts";

// The 2026 season has two naming vocabularies with zero exact overlap. The
// committed CSVs cover Jan 1 - May 17 with short canonical names; the ESPN log
// covers May 18 onward with sponsored ones. Four tournaments straddle the
// cutoff and appear in both, under different names:
//
//   CSV 20260517 Geneva     | ndjson Gonet Geneva Open
//   CSV 20260517 Hamburg    | ndjson Bitpanda Hamburg Open
//   CSV 20260517 Strasbourg | ndjson Internationaux de Strasbourg presented by Mammotion
//   CSV 20260518 Rabat      | ndjson Grand Prix Son Altesse Royale  La Princesse Lalla Meryem
//
// Without canonicalisation each shows up twice in a season index.

test("sponsor prefixes and suffixes collapse onto the CSV short name", () => {
  const pairs: Array<[string, string]> = [
    ["Gonet Geneva Open", "Geneva"],
    ["Bitpanda Hamburg Open", "Hamburg"],
    ["Terra Wortmann Open", "Halle"],
    ["Lexus Eastbourne Open", "Eastbourne"],
    ["Bad Homburg Open powered by Solarwatt", "Bad Homburg"],
    ["Internationaux de Strasbourg presented by Mammotion", "Strasbourg"],
  ];
  for (const [espn, csv] of pairs) {
    assert.equal(
      canonicalTournament(espn),
      canonicalTournament(csv),
      `${espn} should canonicalise to the same key as ${csv}`,
    );
  }
});

test("the slams survive stripping", () => {
  assert.equal(tournamentSlug("US Open"), "us-open");
  assert.equal(tournamentSlug("Wimbledon"), "wimbledon");
  assert.equal(tournamentSlug("Roland Garros"), "roland-garros");
  assert.equal(tournamentSlug("Australian Open"), "australian-open");
});

test("ATP and WTA names for one event collapse", () => {
  // The CSVs themselves drift across tours.
  for (const [a, b] of [
    ["Indian Wells Masters", "Indian Wells"],
    ["Madrid Masters", "Madrid"],
    ["Rome Masters", "Rome"],
    ["Cincinnati Masters", "Cincinnati Open"],
  ] as Array<[string, string]>) {
    assert.equal(canonicalTournament(a), canonicalTournament(b), `${a} vs ${b}`);
  }
});

test("team ties collapse to one event each", () => {
  assert.equal(tournamentSlug("Davis Cup QLS R1: AUS vs ECU"), "davis-cup");
  assert.equal(tournamentSlug("Davis Cup QLS R1: BEL vs BUL"), "davis-cup");
  assert.equal(tournamentSlug("BJK Cup Qualifiers"), "bjk-cup");
  assert.equal(tournamentSlug("Billie Jean King Cup Finals"), "bjk-cup");
});

test("stripping never empties a name", () => {
  // "Open", "Championships" and "Classic" are generic tokens, but a name made
  // only of them still has to slug to something addressable.
  for (const n of ["Open", "The Championships", "Classic", "Cup"]) {
    assert.ok(tournamentSlug(n).length > 0, `${n} slugged to nothing`);
  }
});

test("distinct events do not collide", () => {
  const names = [
    "US Open", "Wimbledon", "Roland Garros", "Australian Open",
    "Geneva", "Hamburg", "Halle", "Eastbourne", "Bad Homburg", "Strasbourg",
    "Cincinnati Open", "Winston-Salem Open", "Rome", "Madrid", "Indian Wells",
    "Miami", "Monte Carlo Masters", "Barcelona", "Doha", "Dubai",
  ];
  const slugs = names.map(tournamentSlug);
  assert.equal(new Set(slugs).size, slugs.length, `collision in ${JSON.stringify(slugs)}`);
});

test("slugging is idempotent and deterministic", () => {
  for (const n of ["Gonet Geneva Open", "US Open", "Davis Cup QLS R1: AUS vs ECU"]) {
    const once = tournamentSlug(n);
    assert.equal(tournamentSlug(n), once);
    assert.equal(tournamentSlug(once), once, `${once} should be a fixed point`);
  }
});

test("apostrophes close up rather than splitting the slug", () => {
  assert.equal(tournamentSlug("HSBC Championships"), "queens-club");
  assert.equal(tournamentSlug("The HSBC Championships"), "queens-club");
  assert.equal(tournamentSlug("Libema Open"), "s-hertogenbosch");
});

test("one city hosting two tournaments does not merge them", () => {
  // Hamburg has the ATP Bitpanda Open on clay in May and the WTA MSC Ladies
  // Open in July. Merging on the city would claim one event ran for 70 days.
  assert.notEqual(
    canonicalTournament("Bitpanda Hamburg Open"),
    canonicalTournament("MSC Hamburg Ladies Open"),
  );
  assert.equal(canonicalTournament("Bitpanda Hamburg Open"), canonicalTournament("Hamburg"));
});

test("the five cutoff straddlers each resolve to their CSV name", () => {
  // These appear in both sources under different names. Anything that breaks
  // one of these silently doubles that tournament in the season index.
  const pairs: Array<[string, string]> = [
    ["Gonet Geneva Open", "Geneva"],
    ["Bitpanda Hamburg Open", "Hamburg"],
    ["Boss Open", "Stuttgart"],
    ["Internationaux de Strasbourg presented by Mammotion", "Strasbourg"],
    ["Grand Prix Son Altesse Royale  La Princesse Lalla Meryem", "Rabat"],
  ];
  for (const [espn, csv] of pairs) {
    assert.equal(tournamentSlug(espn), tournamentSlug(csv), `${espn} -> ${csv}`);
  }
});
