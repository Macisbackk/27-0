/**
 * Squad chemistry + mid-season fork tests (Classic mode).
 * Run: npm run test:chemistry   (or: bun scripts/test-chemistry.ts)
 *
 * - computeChemistry: adjacent same-line pairs sharing a club OR an era card year
 *   link for +0.5 each, capped at +3.0; current-season cards never link by year.
 * - getChemistryGain / getNewChemistryLinks drive the picker's "+0.5 link" badge.
 * - simulateSeason: chemistry raises the effective rating in Classic (deterministic) and has
 *   no effect in Era (v1.40), the
 *   round-14 fork leaves rounds 1–14 untouched, "chase" only moves points, and
 *   the same seed + choice always gives the same season.
 */
import {
  CHEMISTRY_MAX_BONUS,
  CHEMISTRY_PAIRS,
  computeChemistry,
  getChemistryGain,
  getNewChemistryLinks,
} from "../src/lib/game/chemistry";
import {
  HALFWAY_CALL_OPTIONS,
  HALFWAY_CALL_ROUND,
  applyHalfwayScoreEffect,
  getHalfwayCallLabel,
  getHalfwayRatingDelta,
} from "../src/lib/game/halfway-call";
import {
  SEASON_GAMES,
  simulateSeason,
  type MatchFixture,
  type SeasonResult,
} from "../src/lib/game/season-simulation";
import { createEmptySquad } from "../src/lib/positions";
import type { Player, Position, SquadSlot } from "../src/lib/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

function mockPlayer(
  id: string,
  position: Position,
  club: string,
  year: number,
  rating = 84
): Player {
  return {
    id: `${id}-${year}`,
    name: id,
    club,
    displayClub: year === 2026 ? club : `${club} '${String(year).slice(-2)}`,
    runClub: year === 2026 ? club : `${club} '${String(year).slice(-2)}`,
    year,
    cardYear: year,
    position,
    nationality: "England",
    yearsActive: `${year - 5}–${year + 3}`,
    category: year === 2026 ? "current" : "historic",
    peakRating: rating,
    value: 500_000,
    intlCaps: 0,
  };
}

function withPlayers(
  assignments: Record<number, Player | null>
): SquadSlot[] {
  return createEmptySquad().map((slot) => ({
    ...slot,
    player: assignments[slot.slotIndex] ?? null,
  }));
}

/* --------------------------------------------------------- chemistry pairs */

assert(
  CHEMISTRY_PAIRS.every(([a, b]) => a !== b && a >= 0 && b >= 0 && a <= 12 && b <= 12),
  "chemistry pairs reference valid distinct slots"
);
assert(
  CHEMISTRY_PAIRS.some(([a, b]) => (a === 1 && b === 3) || (a === 3 && b === 1)) &&
    CHEMISTRY_PAIRS.some(([a, b]) => (a === 5 && b === 6) || (a === 6 && b === 5)) &&
    CHEMISTRY_PAIRS.some(([a, b]) => (a === 7 && b === 8) || (a === 8 && b === 7)) &&
    CHEMISTRY_PAIRS.some(([a, b]) => (a === 10 && b === 11) || (a === 11 && b === 10)),
  "pairs cover wing↔centre, halves, front row and back row"
);

/* ------------------------------------------------------ computeChemistry */

assert(computeChemistry(createEmptySquad()).bonus === 0, "empty squad has no chemistry");

{
  // Left wing + left centre both Wigan (current cards): one club link.
  const squad = withPlayers({
    1: mockPlayer("wing", "WING", "Wigan Warriors", 2026),
    3: mockPlayer("centre", "CENTRE", "Wigan Warriors", 2026),
  });
  const result = computeChemistry(squad);
  assert(result.bonus === 0.5, "one same-club pair = +0.5");
  assert(
    result.links.length === 1 && result.links[0].reason === "club",
    "link reason is club"
  );
}

{
  // Current cards from different clubs share the 2026 season — must NOT link by year.
  const squad = withPlayers({
    1: mockPlayer("wing", "WING", "Wigan Warriors", 2026),
    3: mockPlayer("centre", "CENTRE", "Leeds Rhinos", 2026),
  });
  assert(computeChemistry(squad).bonus === 0, "current-season year never links");
}

{
  // Era cards: Bradford '03 next to Leeds '03 link by year.
  const squad = withPlayers({
    5: mockPlayer("so", "STAND_OFF", "Bradford Bulls", 2003),
    6: mockPlayer("sh", "SCRUM_HALF", "Leeds Rhinos", 2003),
  });
  const result = computeChemistry(squad);
  assert(result.bonus === 0.5 && result.links[0]?.reason === "year", "same era year links");
}

{
  // Bradford '03 and Bradford '05 — club link wins (different years).
  const squad = withPlayers({
    5: mockPlayer("so", "STAND_OFF", "Bradford Bulls", 2003),
    6: mockPlayer("sh", "SCRUM_HALF", "Bradford Bulls", 2005),
  });
  const result = computeChemistry(squad);
  assert(result.bonus === 0.5 && result.links[0]?.reason === "club", "era suffix stripped for club match");
}

{
  // Non-adjacent / different line never link (fullback vs loose forward, wing vs prop).
  const squad = withPlayers({
    0: mockPlayer("fb", "FULLBACK", "Wigan Warriors", 2026),
    11: mockPlayer("lf", "LOOSE_FORWARD", "Wigan Warriors", 2026),
    2: mockPlayer("rw", "WING", "Wigan Warriors", 2026),
    7: mockPlayer("lp", "PROP", "Wigan Warriors", 2026),
  });
  assert(computeChemistry(squad).bonus === 0, "only same-line adjacent slots link");
}

{
  // Everyone from one club: 7 pairs = 3.5 raw, capped at 3.0.
  const assignments: Record<number, Player> = {};
  const positions: Position[] = [
    "FULLBACK", "WING", "WING", "CENTRE", "CENTRE", "STAND_OFF", "SCRUM_HALF",
    "PROP", "HOOKER", "PROP", "SECOND_ROW", "LOOSE_FORWARD", "SECOND_ROW",
  ];
  positions.forEach((pos, i) => {
    assignments[i] = mockPlayer(`p${i}`, pos, "St Helens", 2026, 86);
  });
  const result = computeChemistry(withPlayers(assignments));
  assert(result.links.length === CHEMISTRY_PAIRS.length, "every pair links for a one-club side");
  assert(result.bonus === CHEMISTRY_MAX_BONUS, `bonus capped at +${CHEMISTRY_MAX_BONUS}`);
}

/* ------------------------------------------- picker gain / new links */

{
  const squad = withPlayers({
    8: mockPlayer("hooker", "HOOKER", "Hull FC", 2026),
  });
  const hullProp = mockPlayer("prop", "PROP", "Hull FC", 2026);
  const catsProp = mockPlayer("prop2", "PROP", "Catalans Dragons", 2026);
  assert(getChemistryGain(squad, 7, hullProp) === 0.5, "signing a same-club prop beside the hooker gains +0.5");
  assert(getChemistryGain(squad, 7, catsProp) === 0, "a different-club prop gains nothing");
  assert(getChemistryGain(squad, 0, hullProp) === 0, "same club in an unlinked slot gains nothing");
  const links = getNewChemistryLinks(squad, 7, hullProp);
  assert(
    links.length === 1 && links[0].slotA === 7 && links[0].slotB === 8,
    "new link reported between the signed slot and the hooker"
  );

  // Both props Hull FC → hooker links to both: cumulative +1.0.
  const both = withPlayers({
    7: hullProp,
    8: mockPlayer("hooker", "HOOKER", "Hull FC", 2026),
  });
  assert(
    getChemistryGain(both, 9, mockPlayer("prop3", "PROP", "Hull FC", 2026)) === 0.5 &&
      computeChemistry(both).bonus === 0.5,
    "second prop adds a second link"
  );
}

/* ----------------------------------------------------- halfway call */

assert(HALFWAY_CALL_ROUND === 14, "fork sits at round 14");
assert(
  HALFWAY_CALL_OPTIONS.map((o) => o.label).join("|") ===
    "Rest the stars|Push for the top two|Chase the points difference",
  "three fork options with the expected labels"
);
assert(getHalfwayCallLabel("rest") === "Rest the stars", "label lookup");
assert(getHalfwayCallLabel(undefined) === "No change", "undefined call reads as no change");

assert(getHalfwayRatingDelta("rest", 14) === 0, "rest: round 14 unaffected");
assert(getHalfwayRatingDelta("rest", 15) === -1.5 && getHalfwayRatingDelta("rest", 18) === -1.5, "rest: −1.5 rounds 15–18");
assert(getHalfwayRatingDelta("rest", 19) === 1 && getHalfwayRatingDelta("rest", 27) === 1, "rest: +1.0 rounds 19–27");
assert(getHalfwayRatingDelta("push", 15) === 1 && getHalfwayRatingDelta("push", 22) === 1, "push: +1.0 rounds 15–22");
assert(getHalfwayRatingDelta("push", 23) === -1 && getHalfwayRatingDelta("push", 27) === -1, "push: −1.0 rounds 23–27");
assert(
  [15, 20, 27].every((r) => getHalfwayRatingDelta("chase", r) === 0) &&
    [15, 20, 27].every((r) => getHalfwayRatingDelta("none", r) === 0),
  "chase / none never change the rating"
);

{
  const base: MatchFixture = {
    round: 20,
    opponent: "Leeds Rhinos",
    isHome: true,
    pointsFor: 24,
    pointsAgainst: 12,
    triesFor: 4,
    triesAgainst: 2,
    scoringFor: { tries: 4, conversions: 4, penalties: 0, dropGoals: 0, points: 24 },
    scoringAgainst: { tries: 2, conversions: 2, penalties: 0, dropGoals: 0, points: 12 },
    result: "W",
  };
  const win = applyHalfwayScoreEffect(base, "chase");
  assert(
    win.pointsFor === 28 && win.triesFor === 5 && win.scoringFor.tries === 5 && win.scoringFor.points === 28 && win.pointsAgainst === 12,
    "chase: a win scores +4 (one more try)"
  );
  const lossBase: MatchFixture = {
    ...base,
    result: "L",
    pointsFor: 12,
    pointsAgainst: 24,
    triesFor: 2,
    triesAgainst: 4,
    scoringFor: base.scoringAgainst,
    scoringAgainst: base.scoringFor,
  };
  const loss = applyHalfwayScoreEffect(lossBase, "chase");
  assert(
    loss.pointsAgainst === 26 && loss.scoringAgainst.penalties === 1 && loss.scoringAgainst.points === 26 && loss.pointsFor === 12 && loss.result === "L",
    "chase: a loss concedes +2 (a penalty) and stays a loss"
  );
  const early = { ...base, round: 14 };
  const draw: MatchFixture = { ...base, result: "D", pointsAgainst: 24 };
  assert(
    applyHalfwayScoreEffect(early, "chase") === early &&
      applyHalfwayScoreEffect(base, "rest") === base &&
      applyHalfwayScoreEffect(base, "none") === base &&
      applyHalfwayScoreEffect(draw, "chase") === draw,
    "chase leaves rounds ≤14, other plans and draws alone"
  );
}

/* ------------------------------------------------ season sim integration */

function fullSquad(club: (i: number) => string, year: (i: number) => number, rating = 86): SquadSlot[] {
  const positions: Position[] = [
    "FULLBACK", "WING", "WING", "CENTRE", "CENTRE", "STAND_OFF", "SCRUM_HALF",
    "PROP", "HOOKER", "PROP", "SECOND_ROW", "LOOSE_FORWARD", "SECOND_ROW",
  ];
  const assignments: Record<number, Player> = {};
  positions.forEach((pos, i) => {
    assignments[i] = mockPlayer(`sim${i}`, pos, club(i), year(i), rating);
  });
  return withPlayers(assignments);
}

const CLUBS = ["Wigan Warriors", "St Helens", "Leeds Rhinos", "Hull FC", "Warrington Wolves", "Catalans Dragons", "Hull KR"];
const mixed = fullSquad((i) => CLUBS[i % CLUBS.length], () => 2026);
const oneClub = fullSquad(() => "Wigan Warriors", () => 2026);
const seed = "chemistry-test-seed";

function sameFirstRounds(a: SeasonResult, b: SeasonResult, upTo: number): boolean {
  for (let i = 0; i < upTo; i++) {
    const x = a.fixtures[i];
    const y = b.fixtures[i];
    if (
      x.opponent !== y.opponent ||
      x.pointsFor !== y.pointsFor ||
      x.pointsAgainst !== y.pointsAgainst ||
      x.result !== y.result
    ) {
      return false;
    }
  }
  return true;
}

{
  assert(computeChemistry(mixed).bonus === 0, "rotating-club squad has no links");
  const noChem = simulateSeason(mixed, seed);
  assert(noChem.fixtures.length === SEASON_GAMES, "season still 27 rounds");
  assert(noChem.chemistryBonus === 0 && noChem.halfwayCall === "none", "result records chemistry 0 / no call");

  // Chemistry counts in Classic only (v1.40): these are 2026 cards, so a Classic season.
  const CLASSIC = { currentSeasonOnly: true } as const;
  const chem = simulateSeason(oneClub, seed, CLASSIC);
  const chemOff = simulateSeason(oneClub, seed, { ...CLASSIC, applyChemistry: false });
  assert(chem.chemistryBonus === CHEMISTRY_MAX_BONUS, "one-club squad records the capped bonus");
  assert(chemOff.chemistryBonus === 0, "applyChemistry:false records 0");
  const era = simulateSeason(oneClub, seed);
  const eraOff = simulateSeason(oneClub, seed, { applyChemistry: false });
  assert(
    era.chemistryBonus === 0 && era.gameResults.join("") === eraOff.gameResults.join(""),
    "Era: chemistry has no effect (records 0, same season as with it off)"
  );
  const again = simulateSeason(oneClub, seed, CLASSIC);
  assert(
    JSON.stringify(again.fixtures) === JSON.stringify(chem.fixtures),
    "same seed + squad reproduces the same season"
  );

  // Chemistry should help over many seeds (effective rating +3.0).
  let chemWins = 0;
  let plainWins = 0;
  for (let i = 0; i < 40; i++) {
    chemWins += simulateSeason(oneClub, `${seed}-${i}`, CLASSIC).wins;
    plainWins += simulateSeason(oneClub, `${seed}-${i}`, { ...CLASSIC, applyChemistry: false }).wins;
  }
  assert(chemWins >= plainWins, `chemistry never costs wins across 40 seeds (${chemWins} vs ${plainWins})`);
}

{
  const none = simulateSeason(mixed, seed, { halfwayCall: "none" });
  const rest = simulateSeason(mixed, seed, { halfwayCall: "rest" });
  const push = simulateSeason(mixed, seed, { halfwayCall: "push" });
  const chase = simulateSeason(mixed, seed, { halfwayCall: "chase" });

  assert(
    sameFirstRounds(none, rest, HALFWAY_CALL_ROUND) &&
      sameFirstRounds(none, push, HALFWAY_CALL_ROUND) &&
      sameFirstRounds(none, chase, HALFWAY_CALL_ROUND),
    "rounds 1–14 identical regardless of the halfway call"
  );
  assert(
    rest.halfwayCall === "rest" && push.halfwayCall === "push" && chase.halfwayCall === "chase",
    "result records the chosen call"
  );
  assert(
    JSON.stringify(simulateSeason(mixed, seed, { halfwayCall: "rest" }).fixtures) ===
      JSON.stringify(rest.fixtures),
    "same seed + choice is deterministic"
  );

  // Chase: results identical to "none", points padded after round 14 only.
  const resultsMatch = chase.fixtures.every((f, i) => f.result === none.fixtures[i].result);
  const padded = chase.fixtures.every((f, i) => {
    const n = none.fixtures[i];
    if (f.round <= HALFWAY_CALL_ROUND) return f.pointsFor === n.pointsFor && f.pointsAgainst === n.pointsAgainst;
    if (f.result === "W") return f.pointsFor === n.pointsFor + 4 && f.pointsAgainst === n.pointsAgainst;
    if (f.result === "L") return f.pointsAgainst === n.pointsAgainst + 2 && f.pointsFor === n.pointsFor;
    return f.pointsFor === n.pointsFor && f.pointsAgainst === n.pointsAgainst;
  });
  assert(resultsMatch, "chase never flips a result");
  assert(padded, "chase pads +4 per win / +2 conceded per loss from round 15");
  assert(chase.wins === none.wins && chase.losses === none.losses, "chase keeps the W-L record");
  const pf = chase.fixtures.reduce((s, f) => s + f.pointsFor, 0);
  const pa = chase.fixtures.reduce((s, f) => s + f.pointsAgainst, 0);
  assert(
    chase.pointsFor === pf && chase.pointsAgainst === pa && chase.pointsDifference === pf - pa,
    "chase season totals match the padded fixtures"
  );
  const tries = chase.fixtures.reduce((s, f) => s + f.triesFor, 0);
  const scorerTries = chase.tryScorers.reduce((s, t) => s + t.tries, 0);
  assert(scorerTries === tries, "try scorers still account for every (padded) try");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
