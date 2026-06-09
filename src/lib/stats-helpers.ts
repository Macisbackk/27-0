import { getPlayerById, isHistoricPlayer } from "./players";
import type { Player } from "./types";

export interface ClubSquadStats {
  bestBradfordSquad: number;
  bestWiganSquad: number;
  bestLeedsSquad: number;
  bestStHelensSquad: number;
  bestHistoricSquad: number;
  mostValuablePlayerEverPulled: string | null;
  mostValuablePlayerEverPulledVal: number;
}

export function getSignedPlayers(signedIds: string[]): Player[] {
  return signedIds
    .map((id) => getPlayerById(id))
    .filter((p): p is Player => !!p);
}

export function getClubSquadValue(
  signedIds: string[],
  clubName: string
): number {
  return getSignedPlayers(signedIds)
    .filter((p) => p.club === clubName)
    .reduce((sum, p) => sum + p.value, 0);
}

export function getHistoricSquadValue(signedIds: string[]): number {
  const players = getSignedPlayers(signedIds);
  if (players.length === 0) return 0;
  if (!players.every(isHistoricPlayer)) return 0;
  return players.reduce((sum, p) => sum + p.value, 0);
}

export function getMostValuableSigned(
  signedIds: string[]
): { name: string; value: number } {
  let best = { name: "—", value: 0 };
  for (const id of signedIds) {
    const p = getPlayerById(id);
    if (p && p.value > best.value) {
      best = { name: p.name, value: p.value };
    }
  }
  return best;
}

export function computeClubStats(signedIds: string[]): ClubSquadStats {
  const mostValuable = getMostValuableSigned(signedIds);

  return {
    bestBradfordSquad: getClubSquadValue(signedIds, "Bradford Bulls"),
    bestWiganSquad: getClubSquadValue(signedIds, "Wigan Warriors"),
    bestLeedsSquad: getClubSquadValue(signedIds, "Leeds Rhinos"),
    bestStHelensSquad: getClubSquadValue(signedIds, "St Helens"),
    bestHistoricSquad: getHistoricSquadValue(signedIds),
    mostValuablePlayerEverPulled: mostValuable.name,
    mostValuablePlayerEverPulledVal: mostValuable.value,
  };
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
