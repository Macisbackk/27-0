import type { AchievementCheckContext } from "./achievementContext";

export const ACHIEVEMENT_CHECK_EVENT = "27-0-achievement-check";

/** Fire achievement checks from non-React code (storage, game engines). */
export function dispatchAchievementCheck(
  ctx: AchievementCheckContext = {}
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ACHIEVEMENT_CHECK_EVENT, { detail: ctx })
  );
}
