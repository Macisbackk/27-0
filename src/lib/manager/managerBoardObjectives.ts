import type { ManagerClubExpectationTier } from "./club-config";
import type { ManagerCareer } from "./types";
import { getCareerClubStars, getCareerExpectationTier } from "./managerDifficulty";

export interface ManagerBoardObjectiveIntro {
  club: string;
  seasonYear: number;
  stars: number;
  primaryObjective: string;
  successDetail: string;
  secondaryAims: string[];
  confidenceNote: string;
}

export function shouldShowManagerObjectivesIntro(
  career: ManagerCareer
): boolean {
  return career.objectivesIntroShown === false;
}

export function getBoardObjectiveSuccessDetail(
  tier: ManagerClubExpectationTier
): string {
  switch (tier) {
    case "title":
      return "Win the Grand Final.";
    case "top":
      return "Finish top 3.";
    case "playoffs":
      return "Finish top 6.";
    case "mid-table":
      return "Finish 10th or higher.";
    case "avoid-bottom":
    case "survive":
      return "Finish 12th or higher.";
  }
}

export function getManagerBoardObjectiveIntro(
  career: ManagerCareer
): ManagerBoardObjectiveIntro {
  const tier = getCareerExpectationTier(career);
  const stars = getCareerClubStars(career);

  return {
    club: career.club,
    seasonYear: career.seasonYear,
    stars,
    primaryObjective: career.boardExpectation,
    successDetail: getBoardObjectiveSuccessDetail(tier),
    secondaryAims: [
      "Challenge Cup run",
      "Control wages",
      "Build the squad",
    ],
    confidenceNote: `${career.boardConfidence}% confidence · hit ${career.boardExpectation}.`,
  };
}
