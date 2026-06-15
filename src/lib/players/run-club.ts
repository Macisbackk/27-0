import type { Player } from "../types";
import { resolveEraTeamClubName } from "./era-teams";
import { withEraYear } from "./player-age";

/** Original club from the player database — never overwritten. */
export function getPlayerBaseClub(player: Player): string {
  return player.baseClub ?? player.club;
}

/** Club shown for this run (era team display name when in Era Mode). */
export function getPlayerDisplayClub(player: Player): string {
  return player.displayClub ?? player.runClub ?? player.club;
}

/** Club used for colours/gradients (strips era year suffix when needed). */
export function getPlayerColorClub(
  player: Player,
  clubColorOverride?: string
): string {
  if (clubColorOverride) return clubColorOverride;
  return resolveEraTeamClubName(getPlayerDisplayClub(player));
}

/** Attach run-context club fields without mutating database records. */
export function withRunClub(
  player: Player,
  runClub: string,
  options?: { eraYear?: number }
): Player {
  const baseClub = player.baseClub ?? player.club;
  let result: Player = {
    ...player,
    baseClub,
    runClub,
    displayClub: runClub,
  };
  if (options?.eraYear !== undefined) {
    result = withEraYear(result, options.eraYear);
  }
  return result;
}

export function playerHasRunClub(player: Player): boolean {
  return Boolean(player.runClub ?? player.displayClub);
}
