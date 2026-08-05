/**
 * Regression cover for pre-season friendly scheduling.
 *
 * The calendar has no next fixture while pre-season is unfinished, so any
 * pre-season state without an active friendly, a pending pick or a draft
 * awaiting confirmation would stall Manager Mode permanently.
 *
 * Run: npx tsx scripts/test-friendly-schedule.ts
 */
import assert from "node:assert/strict";
import {
  FRIENDLIES_REQUIRED,
  FRIENDLY_SCHEDULE_VERSION,
  completeFriendlyMatch,
  confirmFriendlySchedule,
  ensureFriendlyChoices,
  initPreSeasonState,
  isAwaitingFriendlyChoice,
  isAwaitingFriendlyScheduleConfirm,
  needsPreSeasonFriendlies,
} from "../src/lib/manager/managerFriendlies";
import type {
  ManagerCareer,
  PreSeasonState,
  ScheduledFriendly,
} from "../src/lib/manager/types";

let checks = 0;
function check(label: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`  ok  ${label}`);
}

function scheduled(club: string, friendlyIndex: number): ScheduledFriendly {
  return {
    club,
    year: "2026",
    displayName: club,
    teamRating: 84,
    isHome: friendlyIndex % 2 === 0,
    friendlyIndex,
  };
}

function careerWith(preSeason: PreSeasonState): ManagerCareer {
  return {
    preSeason,
    club: "Leeds Rhinos",
    seed: "test-seed",
    fixtures: [],
  } as unknown as ManagerCareer;
}

/** Pre-season can only progress through one of these three routes. */
function isPlayable(state: PreSeasonState): boolean {
  const career = careerWith(state);
  if (!needsPreSeasonFriendlies(career)) return true;
  return Boolean(
    state.activeFriendly ||
      isAwaitingFriendlyChoice(career) ||
      isAwaitingFriendlyScheduleConfirm(career)
  );
}

console.log("Pre-season friendly schedule");

check("a legacy completed pre-season is not reopened", () => {
  const migrated = initPreSeasonState({
    fixtures: [],
    gameWeek: 6,
    preSeason: {
      friendliesPlayed: 2,
      friendliesRequired: 2,
      awaitingChoice: false,
      currentChoices: [],
      activeFriendly: null,
    } as unknown as PreSeasonState,
  });
  assert.equal(needsPreSeasonFriendlies(careerWith(migrated)), false);
  assert.equal(migrated.friendlyScheduleVersion, FRIENDLY_SCHEDULE_VERSION);
  assert.ok(isPlayable(migrated));
});

check("a legacy mid-pre-season save keeps a route forward", () => {
  const migrated = initPreSeasonState({
    preSeason: {
      friendliesPlayed: 1,
      friendliesRequired: 2,
      awaitingChoice: true,
      currentChoices: [],
      activeFriendly: null,
    } as unknown as PreSeasonState,
  });
  assert.ok(isPlayable(migrated));
});

check("a stalled save is repaired on load", () => {
  const repaired = initPreSeasonState({
    preSeason: {
      friendliesPlayed: 1,
      friendliesRequired: FRIENDLIES_REQUIRED,
      awaitingChoice: false,
      awaitingScheduleConfirm: false,
      currentChoices: [],
      draftSchedule: [],
      confirmedSchedule: [],
      friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
      activeFriendly: null,
    },
  });
  assert.equal(needsPreSeasonFriendlies(careerWith(repaired)), false);
  assert.ok(isPlayable(repaired));
});

check("an in-progress draft is left untouched", () => {
  const drafting = initPreSeasonState({
    preSeason: {
      friendliesPlayed: 0,
      friendliesRequired: FRIENDLIES_REQUIRED,
      awaitingChoice: true,
      awaitingScheduleConfirm: false,
      currentChoices: [],
      draftSchedule: [scheduled("Wigan Warriors", 0)],
      confirmedSchedule: [],
      friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
      activeFriendly: null,
    },
  });
  assert.equal(drafting.friendliesPlayed, 0);
  assert.equal(drafting.draftSchedule?.length, 1);
  assert.ok(isPlayable(drafting));
});

check("a confirmed schedule plays through every friendly", () => {
  const confirmed: ScheduledFriendly[] = [
    scheduled("Wigan Warriors", 0),
    scheduled("St Helens", 1),
    scheduled("Hull FC", 2),
  ].slice(0, FRIENDLIES_REQUIRED);

  let career = careerWith({
    friendliesPlayed: 0,
    friendliesRequired: FRIENDLIES_REQUIRED,
    awaitingChoice: false,
    awaitingScheduleConfirm: false,
    currentChoices: [],
    draftSchedule: confirmed,
    confirmedSchedule: confirmed,
    friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
    activeFriendly: confirmed[0],
  });

  for (let i = 0; i < FRIENDLIES_REQUIRED; i += 1) {
    assert.ok(isPlayable(career.preSeason), `friendly ${i + 1} playable`);
    career = completeFriendlyMatch(career);
  }
  assert.equal(needsPreSeasonFriendlies(career), false);
  assert.equal(career.preSeason.activeFriendly, null);
});

check("ensureFriendlyChoices is a no-op once a draft awaits confirmation", () => {
  // The manager page persists whatever this returns, and persisting always
  // creates a new career identity, so returning a fresh object here would spin
  // the page in an endless render loop and freeze the confirm button.
  const confirmed: ScheduledFriendly[] = Array.from(
    { length: FRIENDLIES_REQUIRED },
    (_, i) => scheduled(`Club ${i}`, i)
  );
  const career = careerWith({
    friendliesPlayed: 0,
    friendliesRequired: FRIENDLIES_REQUIRED,
    awaitingChoice: false,
    awaitingScheduleConfirm: true,
    currentChoices: [],
    draftSchedule: confirmed,
    confirmedSchedule: [],
    friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
    activeFriendly: null,
  });

  assert.equal(isAwaitingFriendlyScheduleConfirm(career), true);
  assert.equal(isAwaitingFriendlyChoice(career), false);
  assert.equal(ensureFriendlyChoices(career), career, "must return same identity");

  const next = confirmFriendlySchedule(career);
  assert.equal(isAwaitingFriendlyScheduleConfirm(next), false);
  assert.ok(next.preSeason.activeFriendly, "confirming sets the first opponent");
});

check("ensureFriendlyChoices only builds a new career when choices are needed", () => {
  const needsChoices = careerWith({
    friendliesPlayed: 0,
    friendliesRequired: FRIENDLIES_REQUIRED,
    awaitingChoice: true,
    awaitingScheduleConfirm: false,
    currentChoices: [],
    draftSchedule: [],
    confirmedSchedule: [],
    friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
    activeFriendly: null,
  });
  const filled = ensureFriendlyChoices(needsChoices);
  assert.ok(filled.preSeason.currentChoices.length > 0, "choices generated");
  assert.equal(
    ensureFriendlyChoices(filled),
    filled,
    "second pass must settle to the same identity"
  );
});

check("finishing a legacy friendly ends pre-season", () => {
  const career = completeFriendlyMatch(
    careerWith({
      friendliesPlayed: 0,
      friendliesRequired: FRIENDLIES_REQUIRED,
      awaitingChoice: false,
      awaitingScheduleConfirm: false,
      currentChoices: [],
      draftSchedule: [],
      confirmedSchedule: [],
      friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
      activeFriendly: scheduled("Leigh Leopards", 0),
    })
  );
  assert.equal(needsPreSeasonFriendlies(career), false);
  assert.ok(isPlayable(career.preSeason));
});

console.log(`\n${checks} checks passed.`);
