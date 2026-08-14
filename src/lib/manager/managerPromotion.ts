import type { ManagerCareer } from "./types";
import {
  isUserInChampionship,
} from "./leagueMembership";
import { getUserLeagueTablePosition } from "./managerFixtures";
import { getAutoPromoteCount } from "./managerLeagues";

/** Only the completed Championship table winner earns automatic promotion. */
export function userFinishedInPromotionPlaces(
  career: ManagerCareer
): boolean {
  if (!isUserInChampionship(career)) return false;
  return (
    career.isSeasonComplete &&
    getUserLeagueTablePosition(career) === getAutoPromoteCount()
  );
}

export function shouldShowPromotionCelebration(
  career: ManagerCareer
): boolean {
  if (career.promotionCelebrationShown) return false;
  if (!career.isSeasonComplete) return false;
  // Championship playoff winners are not promoted — only auto-1st or MPG win.
  return (
    userFinishedInPromotionPlaces(career) ||
    career.millionPoundGame?.winner === career.club
  );
}

export function acknowledgePromotionCelebration(
  career: ManagerCareer
): ManagerCareer {
  return {
    ...career,
    promotionCelebrationShown: true,
    updatedAt: new Date().toISOString(),
  };
}
