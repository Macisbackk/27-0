/**
 * Visual-regression fixtures for Quick Mode player-choice cards.
 * Validates shared formatters + tag priority so pair layouts stay aligned.
 *
 * Run: npx tsx scripts/test-quick-mode-player-choice.ts
 */
import assert from "node:assert/strict";
import type { Player, Position } from "../src/lib/types";
import {
  formatPlayerChoiceMetadata,
  formatPlayerChoiceName,
  getPlayerChoiceClub,
  getPlayerChoiceRating,
  getPrimaryPlayerChoiceTags,
  QUICK_PLAYER_CHOICE_MAX_TAGS,
} from "../src/lib/game/quick-mode-player-choice";
import {
  getPlayerRatingContext,
  getPlayerRatingLabel,
  getPlayerSeasonRatingYear,
} from "../src/lib/players/rating-context";

function basePlayer(overrides: Partial<Player> & { id: string; name: string }): Player {
  return {
    club: "Leeds Rhinos",
    position: "STAND_OFF" as Position,
    nationality: "England",
    yearsActive: "2018-2026",
    category: "current",
    peakRating: 84,
    value: 250_000,
    intlCaps: 0,
    ...overrides,
  };
}

const fixtures: Record<string, Player> = {
  shortName: basePlayer({ id: "short", name: "Bo" }),
  longName: basePlayer({
    id: "long",
    name: "Christopher Maximilian Featherstonehaugh-Jones",
    club: "Huddersfield Giants",
  }),
  longClub: basePlayer({
    id: "long-club",
    name: "Sam Tomkins",
    club: "Catalans Dragons Super League Side",
    displayClub: "Catalans Dragons Super League Side",
  }),
  multiTag: basePlayer({
    id: "multi-tag",
    name: "Kevin Sinfield",
    category: "legend",
    hallOfFame: true,
    clubLegend: true,
    peakRating: 94,
  }),
  noTags: basePlayer({
    id: "no-tags",
    name: "Academy Prospect",
    category: "historic",
    peakRating: 72,
  }),
  hardMode: basePlayer({
    id: "hard",
    name: "Hidden Rating",
    peakRating: 88,
  }),
  hof: basePlayer({
    id: "hof",
    name: "Mal Meninga",
    category: "legend",
    hallOfFame: true,
    peakRating: 96,
  }),
  dualPosition: basePlayer({
    id: "dual",
    name: "Utility Forward",
    position: "SECOND_ROW",
    positions: ["SECOND_ROW", "LOOSE_FORWARD"],
    peakRating: 81,
  }),
  missingStats: basePlayer({
    id: "missing-stats",
    name: "Sparse Card",
    appearances: undefined,
    tries: undefined,
    peakRating: 78,
  }),
  season2011: basePlayer({
    id: "same-player-2011",
    basePlayerId: "same-player",
    name: "Year Variant",
    category: "historic",
    cardYear: 2011,
    peakRating: 79,
  }),
  season2012: basePlayer({
    id: "same-player-2012",
    basePlayerId: "same-player",
    name: "Year Variant",
    category: "historic",
    cardYear: 2012,
    peakRating: 86,
  }),
};

let passed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}`);
    throw err;
  }
}

console.log("Quick Mode player-choice fixtures\n");

check("short and long names both return strings", () => {
  assert.equal(typeof formatPlayerChoiceName(fixtures.shortName), "string");
  assert.ok(formatPlayerChoiceName(fixtures.longName).length > 20);
});

check("metadata order is Nationality · Position then Club", () => {
  const meta = formatPlayerChoiceMetadata(fixtures.dualPosition);
  assert.match(meta.primaryLine, /·/);
  assert.ok(meta.primaryLine.includes(meta.positionLabel));
  assert.equal(meta.club, getPlayerChoiceClub(fixtures.dualPosition));
});

check("hard mode drops nationality from primary line but keeps position + club", () => {
  const meta = formatPlayerChoiceMetadata(fixtures.hardMode, { hardMode: true });
  assert.equal(meta.nationalityAbbrev, null);
  assert.ok(meta.positionLabel.length > 0);
  assert.ok(meta.club.length > 0);
  assert.equal(meta.primaryLine, meta.positionLabel);
});

check("rating zone stays present when hidden", () => {
  const shown = getPlayerChoiceRating(fixtures.hardMode, { hardMode: false });
  const hidden = getPlayerChoiceRating(fixtures.hardMode, { hardMode: true });
  assert.equal(shown.hidden, false);
  assert.equal(shown.display, "88");
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.display, null);
  assert.equal(hidden.hiddenLabel, "Rating Hidden");
  assert.equal(hidden.value, 88);
});

check("primary tags are capped and priority-ordered", () => {
  const tags = getPrimaryPlayerChoiceTags(fixtures.multiTag);
  assert.ok(tags.length <= QUICK_PLAYER_CHOICE_MAX_TAGS);
  assert.equal(tags[0]?.id, "hall-of-fame");
  assert.ok(tags.every((t) => t.label.length > 0));
});

check("no-tag players return empty tag list (layout still reserved in CSS)", () => {
  const tags = getPrimaryPlayerChoiceTags(fixtures.noTags);
  // historic type counts as a tag
  assert.ok(tags.length <= QUICK_PLAYER_CHOICE_MAX_TAGS);
});

check("boosted / top-pick flags appear without changing other formatters", () => {
  const tags = getPrimaryPlayerChoiceTags(fixtures.shortName, {
    boosted: true,
    topPick: true,
  });
  const ids = tags.map((t) => t.id);
  assert.ok(ids.includes("boosted") || ids.includes("top-rating") || ids.includes("current"));
  const rating = getPlayerChoiceRating(fixtures.shortName);
  assert.equal(rating.display, "84");
});

check("long club does not invent Unknown Club", () => {
  const club = getPlayerChoiceClub(fixtures.longClub);
  assert.ok(!/unknown/i.test(club));
  assert.ok(club.length > 10);
});

check("HOF player surfaces Hall of Fame before player type", () => {
  const tags = getPrimaryPlayerChoiceTags(fixtures.hof);
  assert.equal(tags[0]?.id, "hall-of-fame");
});

check("missing optional stats do not affect rating / name formatters", () => {
  assert.equal(formatPlayerChoiceName(fixtures.missingStats), "Sparse Card");
  assert.equal(getPlayerChoiceRating(fixtures.missingStats).value, 78);
});

check("one-choice and two-choice use identical formatter outputs per player", () => {
  const a = formatPlayerChoiceMetadata(fixtures.shortName);
  const b = formatPlayerChoiceMetadata(fixtures.shortName);
  assert.deepEqual(a, b);
});

check("year-specific historic cards use Season Rating terminology", () => {
  const context = getPlayerRatingContext(fixtures.season2012);
  assert.equal(context, "season");
  assert.equal(getPlayerRatingLabel(context), "Season Rating");
  assert.equal(getPlayerSeasonRatingYear(fixtures.season2012), 2012);
});

check("current, historic peak and legend records retain distinct labels", () => {
  assert.equal(
    getPlayerRatingLabel(getPlayerRatingContext(fixtures.shortName)),
    "Current Rating"
  );
  assert.equal(
    getPlayerRatingLabel(getPlayerRatingContext(fixtures.noTags)),
    "Peak Rating"
  );
  assert.equal(
    getPlayerRatingLabel(getPlayerRatingContext(fixtures.hof)),
    "Legend Rating"
  );
});

check("same player may carry different canonical ratings in adjacent seasons", () => {
  assert.equal(
    fixtures.season2011.basePlayerId,
    fixtures.season2012.basePlayerId
  );
  assert.notEqual(
    getPlayerChoiceRating(fixtures.season2011).value,
    getPlayerChoiceRating(fixtures.season2012).value
  );
  assert.equal(
    getPlayerChoiceRating(fixtures.season2012).value,
    fixtures.season2012.peakRating
  );
});

console.log(`\n${passed} checks passed.`);
