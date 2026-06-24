import type { Player, PlayerCategory } from "../types";

/** Current-season squad players — career totals are not shown on cards. */
export function isActivePlayer(player: Player): boolean {
  return player.category === "current";
}

/** Classify active vs historic from career span; legends are unchanged. */
export function resolveCategory(
  rawCategory: PlayerCategory,
  yearsActive: string
): PlayerCategory {
  if (rawCategory === "legend") return "legend";
  if (rawCategory === "current") return "current";
  return yearsActive.includes("Present") ? "current" : "historic";
}
