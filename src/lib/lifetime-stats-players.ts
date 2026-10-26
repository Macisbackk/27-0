/** Lifetime-stat highlights that need player names. Kept apart from `lifetime-stats.ts`
 *  so the site-wide stats storage doesn't import the player database. */
import { getPlayerById, isHiddenPlayer } from "./players";

export function getMostSelectedPlayer(
  draftCounts: Record<string, number>
): { name: string; count: number } | null {
  let bestId: string | null = null;
  let bestCount = 0;

  for (const [id, count] of Object.entries(draftCounts)) {
    if (isHiddenPlayer(id)) continue;
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
    }
  }

  if (!bestId || bestCount === 0) return null;
  return { name: getPlayerById(bestId)?.name ?? bestId, count: bestCount };
}

export function getMostSuccessfulPlayer(
  playerSeasonWins: Record<string, number>
): { id: string; name: string; wins: number } | null {
  let bestId: string | null = null;
  let bestWins = 0;

  for (const [id, wins] of Object.entries(playerSeasonWins)) {
    if (isHiddenPlayer(id)) continue;
    if (wins > bestWins) {
      bestWins = wins;
      bestId = id;
    }
  }

  if (!bestId || bestWins === 0) return null;
  return { id: bestId, name: getPlayerById(bestId)?.name ?? bestId, wins: bestWins };
}

export function getWorstPerformingPlayer(
  playerSeasonLosses: Record<string, number>
): { name: string; losses: number } | null {
  let worstId: string | null = null;
  let worstLosses = 0;

  for (const [id, losses] of Object.entries(playerSeasonLosses)) {
    if (isHiddenPlayer(id)) continue;
    if (losses > worstLosses) {
      worstLosses = losses;
      worstId = id;
    }
  }

  if (!worstId || worstLosses === 0) return null;
  return {
    name: getPlayerById(worstId)?.name ?? worstId,
    losses: worstLosses,
  };
}
