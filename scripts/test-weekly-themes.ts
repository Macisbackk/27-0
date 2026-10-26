/**
 * Rugby league calendar weeks for the Weekly Challenge (lib/weekly-themes.ts): the themed rule
 * is picked by date for the whole UK week and only that week, everyone keeps the same seed,
 * a theme never repeats one of that week's Dailies, the copy fits, and every themed rule can
 * fill all 13 slots on its own (no fallback to unrestricted spins).
 * Run: bun scripts/test-weekly-themes.ts   (or: npx tsx scripts/test-weekly-themes.ts)
 */
import { createEmptySquad, RECRUIT_SLOT_ORDER } from "../src/lib/positions";
import {
  generateSlotTeamYearTargetForSlot,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotTeamYearPlayers,
} from "../src/lib/game/slot-team-year-pick";
import { getSpinRuleFilter, playerPassesRule, poolPassesRule } from "../src/lib/game/daily-rule-filter";
import { getTeamYearPoolFromTarget } from "../src/lib/game/team-year-pools";
import { getDailyChallengeScenario, WEEKLY_THEME_RULE_TYPES, DAILY_RULE_TYPES } from "../src/lib/daily-challenge";
import {
  getWeeklyChallengeDateKeys,
  getWeeklyChallengeScenario,
  getWeeklyChallengeSeed,
  getWeeklyChallengeWeekKey,
} from "../src/lib/weekly-challenge";
import { WEEKLY_THEMES, WEEKLY_THEMES_FROM, getWeeklyThemeForDateKeys } from "../src/lib/weekly-themes";

let passed = 0;
let failed = 0;
function check(condition: unknown, message: string): void {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}
const DAY = 86_400_000;
const noon = (key: string) => new Date(`${key}T12:00:00Z`);

check(
  WEEKLY_THEME_RULE_TYPES.every((t) => !(DAILY_RULE_TYPES as readonly string[]).includes(t)),
  "theme-only rule types never enter the Daily rotation"
);

const weeksWithTheme = new Map<string, string>();
for (const theme of WEEKLY_THEMES) {
  const at = noon(theme.date);
  const weekKey = getWeeklyChallengeWeekKey(at);
  check(!weeksWithTheme.has(weekKey), `${theme.id}: only theme in ${weekKey} (also ${weeksWithTheme.get(weekKey)})`);
  weeksWithTheme.set(weekKey, theme.id);
  check(theme.date >= WEEKLY_THEMES_FROM, `${theme.id}: on or after the start date`);
  check(theme.ruleTitle.length <= 18, `${theme.id}: title fits (${theme.ruleTitle})`);
  check(theme.ruleSummary.length <= 60, `${theme.id}: summary fits (${theme.ruleSummary.length})`);

  // Selected for every instant of its week, with the same id and seed.
  const days = getWeeklyChallengeDateKeys(at);
  check(getWeeklyThemeForDateKeys(days)?.id === theme.id, `${theme.id}: found for its week`);
  const scenario = getWeeklyChallengeScenario(at);
  check(scenario.id === `theme-${theme.id}` && scenario.theme?.id === theme.id, `${theme.id}: the week's Weekly is themed`);
  check(scenario.eraMode === theme.eraMode && scenario.ruleTitle === theme.ruleTitle, `${theme.id}: scenario carries the theme`);
  for (const d of days) {
    const s = getWeeklyChallengeScenario(noon(d));
    check(s.id === scenario.id, `${theme.id}: same rule on ${d}`);
    check(getWeeklyChallengeSeed(noon(d)) === `weekly-${weekKey}`, `${theme.id}: same seed for everyone on ${d}`);
    const daily = getDailyChallengeScenario(noon(d)).rule;
    check(JSON.stringify(daily) !== JSON.stringify(scenario.rule), `${theme.id}: differs from the Daily on ${d}`);
  }
  // Monday 00:30 UK and Sunday 23:30 UK (DST-safe via the week key) stay on the theme.
  const monday = days[0]!;
  const sunday = days[6]!;
  check(getWeeklyChallengeScenario(new Date(`${monday}T00:30:00Z`)).id === scenario.id || getWeeklyChallengeWeekKey(new Date(`${monday}T00:30:00Z`)) !== weekKey, `${theme.id}: Monday early`);
  check(getWeeklyChallengeScenario(new Date(`${sunday}T22:30:00Z`)).id === scenario.id, `${theme.id}: Sunday late`);
  // The weeks either side are not this theme.
  check(getWeeklyChallengeScenario(new Date(at.getTime() - 7 * DAY)).theme?.id !== theme.id, `${theme.id}: not the week before`);
  check(getWeeklyChallengeScenario(new Date(at.getTime() + 7 * DAY)).theme?.id !== theme.id, `${theme.id}: not the week after`);

  // The rule fills all 13 slots strictly (every spin passes the pool filter, every pick the player filter).
  const filter = getSpinRuleFilter(theme.rule);
  check(filter !== null, `${theme.id}: rule restricts the spins`);
  const variant = theme.eraMode ? "era" : "current";
  for (let i = 0; i < 3; i++) {
    const seed = `theme-${theme.id}-${i}`;
    let squad = createEmptySquad();
    const used = new Set<string>();
    let strict = true;
    let spin = 0;
    for (const slotIndex of RECRUIT_SLOT_ORDER) {
      const usedIds = new Set(squad.filter((s) => s.player).map((s) => s.player!.id));
      const target = generateSlotTeamYearTargetForSlot(seed, spin++, usedIds, squad, slotIndex, used, {
        spinVariant: variant,
        ruleFilter: filter,
      });
      const pool = target ? getTeamYearPoolFromTarget(target) : null;
      if (!target || !pool || !poolPassesRule(pool, filter)) {
        strict = false;
        break;
      }
      used.add(target.teamYearKey);
      const offered = prepareSlotTeamYearPlayers(target, usedIds, squad, slotIndex, { seed, ruleFilter: filter });
      const pick = offered.find((e) => playerPassesRule(e.player, filter));
      if (!pick) {
        strict = false;
        break;
      }
      squad = placeSlotRecruitPlayerAtSlot(squad, pick.player, target, slotIndex) ?? squad;
    }
    check(strict && squad.every((s) => s.player), `${theme.id} seed ${i}: all 13 slots fill under the rule`);
  }
}

// Weeks before the start date keep the normal rotation (no week in progress changes rule).
for (let t = Date.UTC(2026, 9, 1, 12); t < Date.parse(`${WEEKLY_THEMES_FROM}T00:00:00Z`) - DAY; t += DAY) {
  check(getWeeklyChallengeScenario(new Date(t)).theme === undefined, `no theme before the start (${new Date(t).toISOString().slice(0, 10)})`);
}
// Theme-free weeks behave as before: rule from the Daily pool.
let plain = 0;
for (let w = 0; w < 60; w++) {
  const at = new Date(Date.UTC(2026, 10, 11, 12) + w * 7 * DAY);
  const s = getWeeklyChallengeScenario(at);
  if (!s.theme) {
    plain++;
    check((DAILY_RULE_TYPES as readonly string[]).includes(s.ruleType), `plain week ${getWeeklyChallengeWeekKey(at)} uses a Daily rule type`);
  }
}
check(plain >= 45, `most weeks stay on the rotation (${plain} of 60)`);

console.log(`\nWeekly themes: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
