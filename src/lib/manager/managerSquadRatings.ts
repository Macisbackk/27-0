import rebalanceRatings from "../../../data/rating-rebalance-batch.json";

const MANAGER_RATING_BY_NAME = new Map<string, number>(
  (rebalanceRatings as { name: string; rating: number }[]).map((entry) => [
    entry.name.toLowerCase(),
    entry.rating,
  ])
);

/** 2026 rebalance ratings for manager mode display and team strength. */
export function getManagerModePlayerRating(
  playerName: string,
  fallback: number
): number {
  return MANAGER_RATING_BY_NAME.get(playerName.toLowerCase()) ?? fallback;
}

export function getManagerClubKeyPlayers(
  playerIds: string[],
  getRating: (id: string) => number,
  getName: (id: string) => string,
  limit = 5
): { playerId: string; name: string; rating: number }[] {
  return playerIds
    .map((id) => ({
      playerId: id,
      name: getName(id),
      rating: getRating(id),
    }))
    .filter((p) => p.rating > 0 && p.name)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
