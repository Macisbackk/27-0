import type { Player } from "../types";
import {
  getPlayerAchievements,
  type AchievementDisplayMode,
  type PlayerAchievement,
} from "./achievements";

const cache = new Map<string, PlayerAchievement[]>();

function cacheKey(playerId: string, mode: AchievementDisplayMode): string {
  return `${playerId}:${mode}`;
}

/** Cached achievements — built once per player/mode for showcase and cards. */
export function getCachedPlayerAchievements(
  player: Player,
  mode: AchievementDisplayMode = "compact"
): PlayerAchievement[] {
  const key = cacheKey(player.id, mode);
  const existing = cache.get(key);
  if (existing) return existing;

  const achievements = getPlayerAchievements(player, mode);
  cache.set(key, achievements);
  return achievements;
}
