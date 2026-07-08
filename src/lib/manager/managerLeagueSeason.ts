import type { ManagerCareer, PlayerDevelopmentState } from "./types";
import { getManagerClubConfig } from "./club-config";

/** Completed seasons before the current campaign (0 in year one). */
export function getLeagueSeasonIndex(career: ManagerCareer): number {
  return career.seasonHistory?.length ?? 0;
}

export function aiClubYouthLevel(club: string): number {
  const stars = getManagerClubConfig(club).difficulty;
  if (stars >= 4.5) return 3;
  if (stars >= 3.5) return 2;
  if (stars >= 2.5) return 1;
  return 0;
}

export function initAiYouthDevelopment(
  career: ManagerCareer,
  playerId: string,
  rating: number,
  potential: number,
  developmentRate: number
): PlayerDevelopmentState {
  return {
    rating,
    peakRating: rating,
    potential,
    developmentRate,
    seasonStartRating: rating,
    promotedSeasonYear: career.seasonYear,
  };
}
