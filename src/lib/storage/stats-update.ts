import type { GameDifficulty, UserStatsData } from "../types";
import { buildSquadFromIds, findBestPosition } from "../game/engine";
import { computeClubStats } from "../stats-helpers-players";
import { applyRunStatsUpdate, type StatsBucket } from "./stats";

/** Record a finished Quick Mode run. Needs the player database (squad lookups). */
export function updateStats(
  signedIds: string[],
  totalValue: number,
  // Kept for call-site compatibility; stats are bucketed by `bucket`.
  _difficulty: GameDifficulty = "NORMAL",
  achievedAt = new Date(),
  bucket: StatsBucket = "normal"
): UserStatsData {
  const squad = buildSquadFromIds(signedIds);
  return applyRunStatsUpdate({
    totalValue,
    bestPosition: findBestPosition(squad),
    clubStats: computeClubStats(signedIds),
    achievedAt,
    bucket,
  });
}
