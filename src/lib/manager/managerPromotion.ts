import type { ManagerCareer } from "./types";
import {
  isUserInChampionship,
  PROMOTE_RELEGATE_COUNT,
} from "./leagueMembership";
import { getUserLeagueTablePosition } from "./managerFixtures";

/** Championship top-N finish that earns Super League promotion. */
export function userFinishedInPromotionPlaces(
  career: ManagerCareer
): boolean {
  if (!isUserInChampionship(career)) return false;
  return getUserLeagueTablePosition(career) <= PROMOTE_RELEGATE_COUNT;
}

export function shouldShowPromotionCelebration(
  career: ManagerCareer
): boolean {
  if (career.promotionCelebrationShown) return false;
  if (!career.isSeasonComplete) return false;
  return userFinishedInPromotionPlaces(career);
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
