import type { Player } from "../types";

/** Current-season squad players — career totals are not shown on cards. */
export function isActivePlayer(player: Player): boolean {
  return player.category === "current";
}
