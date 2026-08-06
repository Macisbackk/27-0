/**
 * Unit tests for canonical player display-name resolver + Showcase search/sort.
 */
import assert from "node:assert/strict";
import {
  getPlayerDisplayName,
  normalizePlayerNameWhitespace,
  resolvePlayerDisplayName,
} from "../src/lib/players/display-name-resolver";
import {
  applyShowcasePipeline,
  type ShowcaseFilters,
} from "../src/lib/players/showcase";
import { toPlayerShowcaseViewModel } from "../src/lib/players/showcase-view-model";
import type { Player } from "../src/lib/types";

function basePlayer(overrides: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    club: "Leeds Rhinos",
    position: "CENTRE",
    nationality: "England",
    yearsActive: "2010–Present",
    category: "current",
    peakRating: 85,
    value: 500_000,
    intlCaps: 0,
    ...overrides,
  };
}

let passed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${label}`);
  } catch (error) {
    console.error(`  ✗ ${label}`);
    throw error;
  }
}

console.log("player display name resolver");

check("prefers fullName / name and trims whitespace", () => {
  const result = resolvePlayerDisplayName({
    id: "p1",
    name: "  Sean   O'Loughlin  ",
  });
  assert.equal(result.displayName, "Sean O'Loughlin");
  assert.equal(result.valid, true);
});

check("joins first + last with a single space", () => {
  assert.equal(
    getPlayerDisplayName({
      id: "p2",
      firstName: "Jamie",
      lastName: "Peacock",
    }),
    "Jamie Peacock"
  );
});

check("preserves apostrophes, hyphens, accents, suffixes", () => {
  assert.equal(
    getPlayerDisplayName({ id: "a", name: "Sean O'Loughlin" }),
    "Sean O'Loughlin"
  );
  assert.equal(
    getPlayerDisplayName({ id: "b", name: "Jean-Pierre" }),
    "Jean-Pierre"
  );
  assert.equal(
    getPlayerDisplayName({ id: "c", name: "García" }),
    "García"
  );
  assert.equal(
    getPlayerDisplayName({ id: "d", name: "Sam Burgess Jr" }),
    "Sam Burgess Jr"
  );
  assert.equal(
    getPlayerDisplayName({ id: "e", name: "Henry VIII" }),
    "Henry VIII"
  );
});

check("does not invent Unknown Player for missing names", () => {
  const result = resolvePlayerDisplayName({ id: "missing-1" });
  assert.equal(result.displayName, "");
  assert.equal(result.valid, false);
  assert.ok(result.problems.includes("missing_name"));
});

check("rejects undefined / [object Object] literals", () => {
  const result = resolvePlayerDisplayName({
    id: "bad",
    name: "undefined",
  });
  assert.equal(result.valid, false);
  assert.equal(result.displayName, "");
});

check("normalizePlayerNameWhitespace collapses runs only", () => {
  assert.equal(
    normalizePlayerNameWhitespace("  A   B  C "),
    "A B C"
  );
});

check("format path never appends season year", () => {
  const historic = basePlayer({
    id: "sam-burgess-2009",
    name: "Sam Burgess",
    category: "historic",
    year: 2009,
    primeYear: 2009,
    cardYear: 2009,
  });
  const view = toPlayerShowcaseViewModel(historic);
  assert.equal(view.displayName, "Sam Burgess");
  assert.ok(!view.displayName.includes("'09"));
  assert.ok(view.clubYearLabel.includes("2009") || view.year === 2009);
});

check("card and popup names match via shared resolver", () => {
  const player = basePlayer({
    id: "legend-kevin-sinfield",
    name: "Kevin Sinfield",
    category: "legend",
    year: 2009,
  });
  const cardName = toPlayerShowcaseViewModel(player).displayName;
  const popupName = getPlayerDisplayName(player);
  assert.equal(cardName, popupName);
});

check("search uses resolved display name", () => {
  const players = [
    basePlayer({ id: "1", name: "Sean O'Loughlin" }),
    basePlayer({ id: "2", name: "Jamie Peacock", club: "Bradford Bulls" }),
  ];
  const filters: ShowcaseFilters = {
    search: "o'loughlin",
    status: "all",
    position: "all",
    club: "all",
    year: "all",
    ratingMin: "all",
    tier: "all",
  };
  const result = applyShowcasePipeline(players, filters, "name", "asc");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "1");
});

check("A–Z sort uses full resolved name and stable id tie-break", () => {
  const players = [
    basePlayer({ id: "b", name: "Zane" }),
    basePlayer({ id: "a", name: "Aaron" }),
    basePlayer({ id: "c", name: "Aaron" }),
  ];
  const filters: ShowcaseFilters = {
    search: "",
    status: "all",
    position: "all",
    club: "all",
    year: "all",
    ratingMin: "all",
    tier: "all",
  };
  const result = applyShowcasePipeline(players, filters, "name", "asc");
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "c", "b"]
  );
});

check("stable keys use player id not name", () => {
  const players = [
    basePlayer({
      id: "leeds-cur-kevin-sinfield",
      name: "Kevin Sinfield",
      category: "current",
    }),
    basePlayer({
      id: "legend-kevin-sinfield",
      name: "Kevin Sinfield",
      category: "legend",
      year: 2009,
    }),
  ];
  assert.notEqual(players[0].id, players[1].id);
  assert.equal(getPlayerDisplayName(players[0]), getPlayerDisplayName(players[1]));
});

console.log(`\n${passed} checks passed`);
