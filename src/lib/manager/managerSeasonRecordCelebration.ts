import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import type { ManagerCareer } from "./types";
import { getUserSeasonGames } from "./leagueMembership";

export type ManagerSeasonRecordCelebrationKind = "perfect" | "winless";

export function isPerfectManagerSeason(career: ManagerCareer): boolean {
  const games = getUserSeasonGames(career);
  return career.wins === games && career.losses === 0;
}

export function isWinlessManagerSeason(career: ManagerCareer): boolean {
  const games = getUserSeasonGames(career);
  return career.wins === 0 && career.losses === games;
}

export function shouldShowPerfectSeasonCelebration(
  career: ManagerCareer
): boolean {
  if (career.perfectSeasonCelebrationShown) return false;
  if (!isLeagueAndCupPhaseComplete(career)) return false;
  return isPerfectManagerSeason(career);
}

export function shouldShowWinlessSeasonCelebration(
  career: ManagerCareer
): boolean {
  if (career.winlessSeasonCelebrationShown) return false;
  if (!isLeagueAndCupPhaseComplete(career)) return false;
  return isWinlessManagerSeason(career);
}

export function resolvePendingSeasonRecordCelebration(
  career: ManagerCareer
): ManagerSeasonRecordCelebrationKind | null {
  if (shouldShowPerfectSeasonCelebration(career)) return "perfect";
  if (shouldShowWinlessSeasonCelebration(career)) return "winless";
  return null;
}
