import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import type { ManagerCareer } from "./types";
import { MANAGER_SEASON_GAMES } from "./types";

export type ManagerSeasonRecordCelebrationKind = "perfect" | "winless";

export function isPerfectManagerSeason(career: ManagerCareer): boolean {
  return (
    career.wins === MANAGER_SEASON_GAMES && career.losses === 0
  );
}

export function isWinlessManagerSeason(career: ManagerCareer): boolean {
  return (
    career.wins === 0 && career.losses === MANAGER_SEASON_GAMES
  );
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
