/**
 * Daily Challenge rule rotation + enforcement tests.
 * Run: npx tsx scripts/test-daily-rules.ts   (or: bun scripts/test-daily-rules.ts)
 *
 * For 400 consecutive UK days:
 * - the scenario is deterministic for the whole day and never repeats yesterday's rule type
 * - titles / summaries fit the home card (≤ 18 / ≤ 60 chars)
 * - every one of the 13 slots can be filled while obeying the rule (spin + choices), from an
 *   empty squad and across three full drafts and Auto-fill with the shared daily seed — without
 *   needing the unrestricted fallback.
 */
import seedrandom from "seedrandom";
import {
  DAILY_RULE_BONUSES,
  DAILY_RULE_TYPES,
  GIANT_KILLER_CLUBS,
  dailyRuleDisablesRespins,
  getDailyChallengeDateKey,
  getDailyChallengeHref,
  getDailyChallengeMinimumBonuses,
  getDailyChallengeScenario,
  getDailyRuleType,
  type DailyChallengeScenario,
} from "../src/lib/daily-challenge";
import {
  getSpinRuleFilter,
  playerPassesRule,
  poolPassesRule,
  type SpinRuleFilter,
} from "../src/lib/game/daily-rule-filter";
import {
  autofillSlotRecruitSquad,
  generateSlotTeamYearTargetForSlot,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotTeamYearPlayers,
} from "../src/lib/game/slot-team-year-pick";
import { pickLegendSpinSlotIndex } from "../src/lib/game/legend-spin";
import { getTeamYearPool, getTeamYearPoolFromTarget } from "../src/lib/game/team-year-pools";
import type { SpinPoolVariant } from "../src/lib/game/player-pool-eligibility";
import { CURRENT_PLAYABLE_CLUBS } from "../src/lib/clubs/super-league-display";
import { getClubBaseStrength } from "../src/lib/game/club-strength";
import { simulateSeason } from "../src/lib/game/season-simulation";
import {
  createEmptySquad,
  getFilledCount,
  RECRUIT_SLOT_ORDER,
  TOTAL_SLOTS,
} from "../src/lib/positions";
import type { SquadSlot } from "../src/lib/types";

const DAYS = 400;
const START = Date.UTC(2026, 0, 1);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(message);
    if (failures.length <= 40) console.error(`  ✗ ${message}`);
  }
}

/** Same UK calendar day at two different times (06:00 and 21:00 UTC are always one London day). */
function dayAt(offset: number, hourUtc: number): Date {
  return new Date(START + offset * 86_400_000 + hourUtc * 3_600_000);
}

function variantOf(scenario: DailyChallengeScenario): SpinPoolVariant {
  return scenario.eraMode ? "era" : "current";
}

function signedIds(squad: SquadSlot[]): Set<string> {
  return new Set(squad.filter((s) => s.player).map((s) => s.player!.id));
}

/** Every slot, from an empty squad, has a rule-abiding spin and rule-abiding choices. */
function checkEverySlotFromEmpty(
  label: string,
  seed: string,
  variant: SpinPoolVariant,
  filter: SpinRuleFilter
): void {
  const squad = createEmptySquad();
  for (const slotIndex of RECRUIT_SLOT_ORDER) {
    const target = generateSlotTeamYearTargetForSlot(
      seed,
      slotIndex,
      new Set(),
      squad,
      slotIndex,
      new Set(),
      { spinVariant: variant, ruleFilter: filter }
    );
    const pool = target ? getTeamYearPoolFromTarget(target) : null;
    const entries = target
      ? prepareSlotTeamYearPlayers(target, new Set(), squad, slotIndex, {
          seed,
          ruleFilter: filter,
        })
      : [];
    assert(
      !!pool &&
        poolPassesRule(pool, filter) &&
        entries.length > 0 &&
        entries.every((e) => playerPassesRule(e.player, filter)),
      `${label}: slot ${slotIndex} fillable under the rule from an empty squad`
    );
  }
}

type DraftStrategy = "in-order-best" | "reverse-first" | "random";

/** Mirror GameBoard's Classic spin loop (legend slot, used team-years, spin index). */
function draftUnderRule(
  label: string,
  seed: string,
  variant: SpinPoolVariant,
  filter: SpinRuleFilter,
  strategy: DraftStrategy
): void {
  let squad = createEmptySquad();
  const usedTeamYearKeys = new Set<string>();
  const legendSlot = pickLegendSpinSlotIndex(seed, squad, new Set(), variant, filter);
  let legendUsed = false;
  let spinIndex = 0;
  const rng = seedrandom(`${seed}-${strategy}`);
  const order =
    strategy === "in-order-best"
      ? [...RECRUIT_SLOT_ORDER]
      : strategy === "reverse-first"
        ? [...RECRUIT_SLOT_ORDER].reverse()
        : [...RECRUIT_SLOT_ORDER].sort(() => rng() - 0.5);

  for (const slotIndex of order) {
    const requireLegendPlayer = !legendUsed && legendSlot === slotIndex;
    const target = generateSlotTeamYearTargetForSlot(
      seed,
      spinIndex,
      signedIds(squad),
      squad,
      slotIndex,
      usedTeamYearKeys,
      { spinVariant: variant, requireLegendPlayer, ruleFilter: filter }
    );
    const pool = target ? getTeamYearPoolFromTarget(target) : null;
    if (!target || !pool || !poolPassesRule(pool, filter)) {
      assert(false, `${label} [${strategy}]: slot ${slotIndex} spin obeys the rule`);
      return;
    }
    const entries = prepareSlotTeamYearPlayers(target, signedIds(squad), squad, slotIndex, {
      seed,
      legendOnly: requireLegendPlayer,
      ruleFilter: filter,
    });
    if (entries.length === 0 || !entries.every((e) => playerPassesRule(e.player, filter))) {
      assert(false, `${label} [${strategy}]: slot ${slotIndex} choices obey the rule`);
      return;
    }
    const pick =
      strategy === "in-order-best"
        ? [...entries].sort((a, b) => b.player.peakRating - a.player.peakRating)[0]!
        : strategy === "reverse-first"
          ? entries[0]!
          : entries[Math.floor(rng() * entries.length)]!;
    const next = placeSlotRecruitPlayerAtSlot(squad, pick.player, target, slotIndex);
    if (!next) {
      assert(false, `${label} [${strategy}]: slot ${slotIndex} signing places`);
      return;
    }
    squad = next;
    usedTeamYearKeys.add(target.teamYearKey);
    if (requireLegendPlayer) legendUsed = true;
    spinIndex += 1;
  }
  assert(
    getFilledCount(squad) === TOTAL_SLOTS,
    `${label} [${strategy}]: all ${TOTAL_SLOTS} slots filled under the rule`
  );
}

function autofillUnderRule(
  label: string,
  seed: string,
  variant: SpinPoolVariant,
  filter: SpinRuleFilter
): void {
  const result = autofillSlotRecruitSquad(seed, 0, createEmptySquad(), new Set(), variant, filter);
  const squadOk =
    !!result &&
    getFilledCount(result.squad) === TOTAL_SLOTS &&
    result.squad.every((s) => s.player && playerPassesRule(s.player, filter));
  const poolsOk =
    !!result &&
    result.usedTeamYearKeys.every((key) => {
      const [team, year] = key.split("|");
      const pool = getTeamYearPool(team!, year!);
      return !!pool && poolPassesRule(pool, filter);
    });
  assert(squadOk && poolsOk, `${label}: Auto-fill fills 13 slots under the rule`);
}

console.log("Daily Challenge rules");

// Giant killers must stay "the strongest clubs".
const strongest = [...CURRENT_PLAYABLE_CLUBS]
  .sort((a, b) => getClubBaseStrength(b) - getClubBaseStrength(a))
  .slice(0, GIANT_KILLER_CLUBS.length);
assert(
  strongest.every((club) => GIANT_KILLER_CLUBS.includes(club)),
  `Giant killers clubs match the top ${GIANT_KILLER_CLUBS.length} by club strength (${strongest.join(", ")})`
);

const minBonuses = getDailyChallengeMinimumBonuses();
assert(
  Object.values(DAILY_RULE_BONUSES).every(
    (b) =>
      b.leagueLeadersBonus >= minBonuses.leagueLeadersBonus &&
      b.playoffTitleBonus >= minBonuses.playoffTitleBonus &&
      b.leagueLeadersBonus > 0 &&
      b.playoffTitleBonus > 0
  ),
  "Daily minimum bonuses cover every rule"
);

const typeCounts = new Map<string, number>();
let previousKey: string | null = null;
let previousType: string | null = null;
let fillChecks = 0;
let giantKillerSimChecked = false;
const t0 = Date.now();

for (let offset = 0; offset < DAYS; offset += 1) {
  const morning = dayAt(offset, 6);
  const evening = dayAt(offset, 21);
  const key = getDailyChallengeDateKey(morning);
  const label = key;

  assert(getDailyChallengeDateKey(evening) === key, `${label}: 06:00 and 21:00 UTC share a UK day`);
  if (previousKey) {
    const [y, m, d] = previousKey.split("-").map(Number) as [number, number, number];
    const expected = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    assert(key === expected, `${label}: consecutive day after ${previousKey}`);
  }

  const scenario = getDailyChallengeScenario(morning);
  const again = getDailyChallengeScenario(evening);
  assert(
    JSON.stringify(scenario) === JSON.stringify(again) &&
      JSON.stringify(scenario) === JSON.stringify(getDailyChallengeScenario(morning)),
    `${label}: scenario is deterministic for the day`
  );
  assert(getDailyRuleType(morning) === scenario.ruleType, `${label}: getDailyRuleType matches`);
  assert(scenario.rule.type === scenario.ruleType, `${label}: rule type matches ruleType`);
  assert(
    (DAILY_RULE_TYPES as readonly string[]).includes(scenario.ruleType),
    `${label}: known rule type`
  );
  assert(
    previousType === null || previousType !== scenario.ruleType,
    `${label}: ${scenario.ruleType} does not repeat yesterday's rule (${previousType})`
  );
  assert(
    scenario.ruleTitle.length > 0 && scenario.ruleTitle.length <= 18,
    `${label}: title "${scenario.ruleTitle}" is ≤ 18 chars`
  );
  assert(
    scenario.ruleSummary.length > 0 && scenario.ruleSummary.length <= 60,
    `${label}: summary "${scenario.ruleSummary}" is ≤ 60 chars`
  );
  assert(
    scenario.title === scenario.ruleTitle && scenario.blurb === scenario.ruleSummary,
    `${label}: legacy title/blurb mirror the rule`
  );
  assert(
    getDailyChallengeHref(morning) === (scenario.eraMode ? "/play?daily=1&era=1" : "/play?daily=1"),
    `${label}: href matches Current/Era`
  );
  assert(
    scenario.leagueLeadersBonus === DAILY_RULE_BONUSES[scenario.ruleType].leagueLeadersBonus &&
      scenario.playoffTitleBonus === DAILY_RULE_BONUSES[scenario.ruleType].playoffTitleBonus,
    `${label}: bonuses come from DAILY_RULE_BONUSES`
  );
  assert(
    scenario.ruleType === "giant-killers"
      ? scenario.forceOpponentClub !== null && GIANT_KILLER_CLUBS.includes(scenario.forceOpponentClub)
      : scenario.forceOpponentClub === null,
    `${label}: forced opponent only on Giant killers days`
  );
  assert(
    dailyRuleDisablesRespins(scenario.rule) === (scenario.ruleType === "no-respins"),
    `${label}: respins disabled only on No respins days`
  );

  typeCounts.set(scenario.ruleType, (typeCounts.get(scenario.ruleType) ?? 0) + 1);

  const filter = getSpinRuleFilter(scenario.rule);
  const needsFilter =
    scenario.ruleType === "one-club" ||
    scenario.ruleType === "era-night" ||
    scenario.ruleType === "underdogs" ||
    scenario.ruleType === "homegrown" ||
    scenario.ruleType === "overseas";
  assert(needsFilter === (filter !== null), `${label}: ${scenario.ruleType} has a spin filter iff it restricts pools`);

  if (filter) {
    const seed = `daily-${key}`; // GameBoard's shared daily seed
    const variant = variantOf(scenario);
    const ruleLabel = `${label} ${scenario.ruleTitle} (${variant})`;
    checkEverySlotFromEmpty(ruleLabel, seed, variant, filter);
    for (const strategy of ["in-order-best", "reverse-first", "random"] as const) {
      draftUnderRule(ruleLabel, seed, variant, filter, strategy);
    }
    autofillUnderRule(ruleLabel, seed, variant, filter);
    fillChecks += 1;
  } else if (scenario.ruleType === "giant-killers" && !giantKillerSimChecked) {
    const seed = `daily-${key}`;
    const filled = autofillSlotRecruitSquad(seed, 0, createEmptySquad(), new Set(), variantOf(scenario));
    const club = scenario.forceOpponentClub!;
    const result = filled
      ? simulateSeason(filled.squad, seed, {
          currentSeasonOnly: !scenario.eraMode,
          forceOpponentClub: club,
        })
      : null;
    assert(
      !!result && result.fixtures.length > 0 && result.fixtures.every((f) => f.opponent.startsWith(club)),
      `${label}: Giant killers season plays only ${club}`
    );
    giantKillerSimChecked = true;
  }

  previousKey = key;
  previousType = scenario.ruleType;
}

for (const type of DAILY_RULE_TYPES) {
  const count = typeCounts.get(type) ?? 0;
  assert(count >= Math.floor(DAYS / DAILY_RULE_TYPES.length) - 1, `${type} appears regularly (${count} of ${DAYS} days)`);
}
assert(giantKillerSimChecked, "Giant killers season simulated at least once");

console.log(
  `  rule mix: ${[...typeCounts].map(([t, n]) => `${t} ${n}`).join(", ")}; ${fillChecks} restricted days fill-checked in ${((Date.now() - t0) / 1000).toFixed(1)}s`
);
if (failures.length > 40) console.error(`  … and ${failures.length - 40} more failures`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
