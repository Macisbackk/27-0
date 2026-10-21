
export interface ClubSquadStats {
  bestBradfordSquad: number;
  bestWiganSquad: number;
  bestLeedsSquad: number;
  bestStHelensSquad: number;
  bestHistoricSquad: number;
  mostValuablePlayerEverPulled: string | null;
  mostValuablePlayerEverPulledVal: number;
}

export function mergeClubStats(
  existing: ClubSquadStats,
  current: ClubSquadStats
): ClubSquadStats {
  return {
    bestBradfordSquad: Math.max(
      existing.bestBradfordSquad,
      current.bestBradfordSquad
    ),
    bestWiganSquad: Math.max(existing.bestWiganSquad, current.bestWiganSquad),
    bestLeedsSquad: Math.max(existing.bestLeedsSquad, current.bestLeedsSquad),
    bestStHelensSquad: Math.max(
      existing.bestStHelensSquad,
      current.bestStHelensSquad
    ),
    bestHistoricSquad: Math.max(
      existing.bestHistoricSquad,
      current.bestHistoricSquad
    ),
    mostValuablePlayerEverPulled:
      current.mostValuablePlayerEverPulledVal >
      existing.mostValuablePlayerEverPulledVal
        ? current.mostValuablePlayerEverPulled
        : existing.mostValuablePlayerEverPulled,
    mostValuablePlayerEverPulledVal: Math.max(
      existing.mostValuablePlayerEverPulledVal,
      current.mostValuablePlayerEverPulledVal
    ),
  };
}
