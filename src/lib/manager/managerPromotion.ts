import type { ManagerCareer } from "./types";
import {
  isUserInChampionship,
} from "./leagueMembership";
import { getUserLeagueTablePosition } from "./managerFixtures";
import { getAutoPromoteCount } from "./managerLeagues";

/** Championship top-N finish that earns Super League promotion. */
export function userFinishedInPromotionPlaces(
  career: ManagerCareer
): boolean {
  if (!isUserInChampionship(career)) return false;
  return getUserLeagueTablePosition(career) <= getAutoPromoteCount();
}

export function shouldShowPromotionCelebration(
  career: ManagerCareer
): boolean {
  if (career.promotionCelebrationShown) return false;
  if (!career.isSeasonComplete) return false;
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
