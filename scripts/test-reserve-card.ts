/**
 * Fixtures for the Reserve player card view-model.
 *
 * Covers the layout-sensitive cases (long names, missing data, dual position)
 * plus the promotion and release rules the card exposes as actions.
 *
 * Run: npx tsx scripts/test-reserve-card.ts
 */
import assert from "node:assert/strict";
import {
  RESERVE_LINEUP_LABELS,
  RESERVE_SQUAD_STATUS_LABELS,
  buildReserveCardModel,
  checkReservePromotion,
  formatReserveMetaLine,
  getReserveLineupStatus,
} from "../src/lib/manager/managerReserveCard";
import {
  SENIOR_SQUAD_LIMIT,
  promoteReserveToSquad,
} from "../src/lib/manager/managerReserves";
import { RESERVE_MIN_RATING } from "../src/lib/players/rating-floors";
import { POSITION_SHORT } from "../src/lib/positions";
import type {
  ManagerCareer,
  ManagerReservePlayer,
  PlayerContract,
} from "../src/lib/manager/types";

let checks = 0;
function check(label: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

function reserve(
  overrides: Partial<ManagerReservePlayer> & { id: string; name: string }
): ManagerReservePlayer {
  return {
    age: 19,
    nationality: "England",
    position: "PROP",
    eligiblePositions: ["PROP"],
    rating: 72,
    baseRating: 70,
    signedRating: 68,
    potentialRating: 88,
    developmentRate: 1,
    form: 60,
    reserveAppearances: 6,
    reserveTries: 2,
    calledUpForNextMatch: false,
    ...overrides,
  };
}

function contract(overrides: Partial<PlayerContract> = {}): PlayerContract {
  return {
    wagePerYear: 24_000,
    yearsRemaining: 3,
    expiresAtSeasonEnd: false,
    squadRole: "reserve",
    happiness: 80,
    ...overrides,
  } as PlayerContract;
}

function career(overrides: Partial<ManagerCareer> = {}): ManagerCareer {
  return {
    club: "Leeds Rhinos",
    seasonYear: 2026,
    squad: [],
    reserves: [],
    contracts: {},
    reserveContracts: {},
    playerRegistry: {},
    playerDevelopment: {},
    playerPositionRetraining: {},
    playerTransferStatus: {},
    matchdayXiii: [],
    matchdayInterchange: [],
    calledUpReserveIds: [],
    ...overrides,
  } as unknown as ManagerCareer;
}

const fixtures = {
  standard: reserve({ id: "r-standard", name: "Ethan Parker" }),
  longName: reserve({
    id: "r-long",
    name: "Bartholomew Fitzwilliam-Harrington",
  }),
  dualPosition: reserve({
    id: "r-dual",
    name: "Kai Ngata",
    position: "SECOND_ROW",
    eligiblePositions: ["SECOND_ROW", "LOOSE_FORWARD"],
  }),
  atFloor: reserve({ id: "r-floor", name: "Sam Low", rating: 65, potentialRating: 70 }),
  potentialReached: reserve({
    id: "r-peak",
    name: "Max Ceiling",
    rating: 80,
    potentialRating: 80,
  }),
  missingNationality: reserve({
    id: "r-nonat",
    name: "Unknown Origin",
    nationality: "",
  }),
};

console.log("Reserve player card view-model\n");

check("meta line always reads position • nationality • age", () => {
  assert.equal(
    formatReserveMetaLine(fixtures.standard),
    `${POSITION_SHORT.PROP} • ENG • Age 19`
  );
});

check("dual position players list both positions in one field", () => {
  const meta = formatReserveMetaLine(fixtures.dualPosition);
  assert.equal(
    meta,
    `${POSITION_SHORT.SECOND_ROW} / ${POSITION_SHORT.LOOSE_FORWARD} • ENG • Age 19`
  );
  assert.equal(meta.split(" • ").length, 3, "field count stays fixed");
});

check("missing nationality degrades without inventing a value", () => {
  const meta = formatReserveMetaLine(fixtures.missingNationality);
  assert.ok(!meta.includes("undefined"));
  assert.ok(!meta.includes("NaN"));
  assert.ok(!meta.includes("Unknown Position"));
});

check("a very long name does not change the meta line structure", () => {
  const short = formatReserveMetaLine(fixtures.standard).split(" • ").length;
  const long = formatReserveMetaLine(fixtures.longName).split(" • ").length;
  assert.equal(short, long);
});

check("current rating and potential stay separate figures", () => {
  const model = buildReserveCardModel(
    career({ reserves: [fixtures.standard] }),
    fixtures.standard
  );
  assert.equal(model.currentRating, 72);
  assert.equal(model.potential, 88);
  assert.notEqual(model.currentRating, model.potential);
});

check("ratings respect the reserve floor of 65", () => {
  const model = buildReserveCardModel(
    career({ reserves: [fixtures.atFloor] }),
    fixtures.atFloor
  );
  assert.ok(model.currentRating >= RESERVE_MIN_RATING);
});

check("a player at their ceiling is not shown as still developing", () => {
  const model = buildReserveCardModel(
    career({ reserves: [fixtures.potentialReached] }),
    fixtures.potentialReached
  );
  assert.equal(model.development.potentialReached, true);
  assert.equal(model.development.trainingLabel, null);
});

check("squad status never uses the old Fringe or Development wording", () => {
  const labels = Object.values(RESERVE_SQUAD_STATUS_LABELS);
  assert.ok(!labels.includes("Fringe"));
  assert.ok(!labels.includes("Development"));
  assert.ok(labels.includes("Reserve"));
});

check("squad status is not inferred from rating alone", () => {
  const star = reserve({
    id: "r-star-status",
    name: "Elite Kid",
    rating: 82,
    potentialRating: 82,
  });
  const model = buildReserveCardModel(career({ reserves: [star] }), star);
  assert.equal(model.squadStatus, "reserve");
  assert.equal(model.squadStatusLabel, "Reserve");

  const calledUp = reserve({
    id: "r-called",
    name: "Bench Ready",
    calledUpForNextMatch: true,
  });
  const calledModel = buildReserveCardModel(
    career({ reserves: [calledUp] }),
    calledUp
  );
  assert.equal(calledModel.squadStatus, "senior-squad-eligible");
});

check("lineup status comes from the saved matchday squad", () => {
  const base = career({ reserves: [fixtures.standard] });
  assert.equal(getReserveLineupStatus(base, fixtures.standard), "not-selected");

  const starting = career({
    reserves: [fixtures.standard],
    matchdayXiii: [fixtures.standard.id],
  });
  assert.equal(getReserveLineupStatus(starting, fixtures.standard), "starting");

  const bench = career({
    reserves: [fixtures.standard],
    matchdayInterchange: [fixtures.standard.id],
  });
  assert.equal(getReserveLineupStatus(bench, fixtures.standard), "interchange");

  assert.equal(RESERVE_LINEUP_LABELS.starting, "Starting");
});

check("a high-rated reserve is not auto-marked as selected", () => {
  const star = reserve({ id: "r-star", name: "Elite Kid", rating: 82 });
  assert.equal(
    getReserveLineupStatus(career({ reserves: [star] }), star),
    "not-selected"
  );
});

check("contract expiry uses the canonical season year", () => {
  const model = buildReserveCardModel(
    career({
      reserves: [fixtures.standard],
      reserveContracts: { [fixtures.standard.id]: contract({ yearsRemaining: 3 }) },
    }),
    fixtures.standard
  );
  assert.equal(model.contract.expiryLabel, "End of 2028");
  assert.equal(model.contract.wageLabel, "£24k/yr");
});

check("a missing contract is reported honestly, not as a fake value", () => {
  const model = buildReserveCardModel(
    career({ reserves: [fixtures.standard] }),
    fixtures.standard
  );
  assert.equal(model.contract.expiryLabel, "Not under contract");
  assert.equal(model.contract.wageLabel, null);
  assert.ok(!model.contract.valueLabel.includes("NaN"));
});

check("promotion is allowed while the senior squad has room", () => {
  const state = career({ reserves: [fixtures.standard] });
  assert.deepEqual(checkReservePromotion(state, fixtures.standard), {
    allowed: true,
    reason: null,
  });
});

check("a full senior squad disables promotion and explains why", () => {
  const full = career({
    reserves: [fixtures.standard],
    squad: Array.from({ length: SENIOR_SQUAD_LIMIT }, (_, i) => ({
      playerId: `p${i}`,
    })),
  } as unknown as Partial<ManagerCareer>);
  const result = checkReservePromotion(full, fixtures.standard);
  assert.equal(result.allowed, false);
  assert.ok(result.reason && result.reason.includes("full"));
});

check("promotion moves the same player without cloning or inflating", () => {
  const start = career({
    reserves: [fixtures.standard],
    reserveContracts: { [fixtures.standard.id]: contract() },
    matchdayInterchange: [fixtures.standard.id],
    calledUpReserveIds: [fixtures.standard.id],
  });

  const result = promoteReserveToSquad(start, fixtures.standard.id);
  assert.ok(result.ok && result.career, result.error);
  const next = result.career!;

  const squadEntries = next.squad.filter(
    (p) => p.playerId === fixtures.standard.id
  );
  assert.equal(squadEntries.length, 1, "no duplicate squad entry");
  assert.equal(
    next.reserves.some((r) => r.id === fixtures.standard.id),
    false,
    "removed from reserves"
  );
  assert.equal(
    next.matchdayInterchange.includes(fixtures.standard.id),
    false,
    "removed from the reserve call-up bench"
  );
  assert.equal(
    next.playerRegistry[fixtures.standard.id]?.peakRating,
    fixtures.standard.rating,
    "rating unchanged by promotion"
  );
  assert.ok(
    next.contracts[fixtures.standard.id],
    "contract carried into the senior squad"
  );
  assert.equal(
    next.reserveContracts?.[fixtures.standard.id],
    undefined,
    "reserve contract cleared"
  );
});

check("status chips always include squad status and lineup status", () => {
  const model = buildReserveCardModel(
    career({ reserves: [fixtures.standard] }),
    fixtures.standard
  );
  assert.ok(model.statusChips.length >= 2);
  assert.equal(model.statusChips[0]!.label, model.squadStatusLabel);
  assert.equal(model.statusChips[1]!.label, model.lineupStatusLabel);
});

check("every card model exposes the same field set", () => {
  const state = career({
    reserves: Object.values(fixtures),
    reserveContracts: { [fixtures.standard.id]: contract() },
  });
  const keys = Object.values(fixtures).map((r) =>
    Object.keys(buildReserveCardModel(state, r)).sort().join(",")
  );
  assert.equal(
    new Set(keys).size,
    1,
    "card models must not vary their shape between players"
  );
});

console.log(`\n${checks} checks passed.`);
