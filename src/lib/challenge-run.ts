/**
 * Glue between a decoded challenge link (lib/challenge-link.ts) and the game: the rule the run
 * was played under, the live-Daily gate and the challenger name default.
 */
import type { ChallengePayload } from "./challenge-link";
import { challengeLiveGate } from "./challenge-link";
import {
  getDailyChallengeAttemptUsed,
  getDailyChallengeDateKey,
  getDailyChallengeScenario,
  type DailyChallengeScenario,
} from "./daily-challenge";
import {
  getWeeklyChallengeAttemptUsed,
  getWeeklyChallengeScenarioForWeek,
  getWeeklyChallengeWeekKey,
} from "./weekly-challenge";

/** The Daily / Weekly rule the challenger played under (null for Classic). */
export function getChallengeRuleScenario(p: Pick<ChallengePayload, "kind" | "key">): DailyChallengeScenario | null {
  try {
    if (p.kind === "daily" && p.key) {
      const [y, m, d] = p.key.split("-").map(Number);
      // Noon UTC is always inside that UK calendar day.
      return getDailyChallengeScenario(new Date(Date.UTC(y!, m! - 1, d!, 12)));
    }
    if (p.kind === "weekly" && p.key) return getWeeklyChallengeScenarioForWeek(p.key);
  } catch {
    // malformed key: treat as no rule (decode already rejects these)
  }
  return null;
}

/** Era squads for the run: the rule decides for a Daily / Weekly, the link for Classic. */
export function getChallengeEraMode(p: ChallengePayload): boolean {
  return getChallengeRuleScenario(p)?.eraMode ?? p.era;
}

export function getChallengeGate(p: ChallengePayload, now = new Date()) {
  return challengeLiveGate(p, {
    dayKey: getDailyChallengeDateKey(now),
    weekKey: getWeeklyChallengeWeekKey(now),
    dailyAttemptUsed: getDailyChallengeAttemptUsed(now),
    weeklyAttemptUsed: getWeeklyChallengeAttemptUsed(now),
  });
}

const NAME_KEY = "27-0-challenge-name";

export function loadChallengerName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveChallengerName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}
