/**
 * Smoke checks for hidden goal-kicking generation + IRL overrides.
 */
import { initializeManagerDatabase } from "../src/lib/manager/database";
import {
  getPlayerGoalKicking,
  pickBestGoalKicker,
  rollGoalKickingRating,
  isEligibleGoalKickerPosition,
} from "../src/lib/manager/goal-kicking";
import { PLAYER_GOAL_KICKING_OVERRIDES } from "../data/player-goal-kicking-overrides";
import type { Position } from "../src/lib/manager/types";

let n = 0;
let ok = 0;
function assert(cond: boolean, msg: string) {
  n++;
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
  ok++;
  console.log("OK", msg);
}

// Props never roll high
for (let i = 0; i < 200; i++) {
  const v = rollGoalKickingRating("PROP");
  assert(v < 55, `prop roll ${v} stays poor`);
}

// Halfbacks majority decent across many rolls
let halfGood = 0;
for (let i = 0; i < 200; i++) {
  if (rollGoalKickingRating("SCRUM_HALF") >= 70) halfGood++;
}
assert(halfGood >= 120, `majority halfbacks good (${halfGood}/200 >= 70)`);

assert(!isEligibleGoalKickerPosition("PROP"), "props ineligible as kickers");
assert(isEligibleGoalKickerPosition("SECOND_ROW"), "second-row eligible");

const state = initializeManagerDatabase("wigan-warriors", "Kick Test");
const sneyd = Object.values(state.players).find((p) => p.name === "Marc Sneyd");
const harry = Object.values(state.players).find((p) => p.name === "Harry Smith");
const prop = Object.values(state.players).find(
  (p) => p.clubId === "wigan-warriors" && p.position === "PROP" && p.squadTier === "first"
);

assert(!!sneyd && !!harry && !!prop, "found Sneyd, Harry Smith, Wigan prop");
assert(
  getPlayerGoalKicking(sneyd!) === PLAYER_GOAL_KICKING_OVERRIDES[sneyd!.id],
  "Sneyd uses IRL override"
);
assert(
  getPlayerGoalKicking(harry!) === PLAYER_GOAL_KICKING_OVERRIDES[harry!.id],
  "Harry Smith uses IRL override"
);
assert(getPlayerGoalKicking(prop!) < 55, "Wigan prop goalKicking stays low");
assert(typeof prop!.goalKicking === "number", "prop has stored goalKicking");

const wiganFirst = Object.values(state.players).filter(
  (p) => p.clubId === "wigan-warriors" && p.squadTier === "first" && !p.loan
);
const best = pickBestGoalKicker(wiganFirst)!;
assert(best.position !== "PROP", "recommended kicker is never a prop");
assert(
  getPlayerGoalKicking(best) >= getPlayerGoalKicking(harry!),
  "Wigan recommended is at least Harry-tier (or higher e.g. Keighran)"
);

const recommendedId = state.clubs["wigan-warriors"].tactics.primaryGoalKickerId;
assert(!!recommendedId, "new career auto-picks a goal kicker");
assert(
  recommendedId === best.id ||
    getPlayerGoalKicking(state.players[recommendedId!]) >= 85,
  "auto goal kicker is a strong tee option"
);

// Generated academy kids have goalKicking
const academy = Object.values(state.players).find(
  (p) => p.clubId === "wigan-warriors" && p.squadTier === "academy"
)!;
assert(typeof academy.goalKicking === "number", "generated academy has goalKicking");
if (academy.position === "PROP") {
  assert(academy.goalKicking! < 55, "generated prop academy poor kicker");
}

console.log(`\nALL GOAL-KICKING CHECKS PASSED (${ok}/${n})`);
