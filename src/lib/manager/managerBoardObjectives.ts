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
      return "Win the Grand Final and lift the Super League title.";
    case "playoffs":
      return "Finish the regular season in the top six to reach the play-offs.";
    case "mid-table":
      return "Finish 10th or higher on the league table.";
    case "avoid-bottom":
    case "survive":
      return "Finish 12th or higher and avoid the bottom places.";
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
      "Compete in the Challenge Cup and go as deep as you can.",
      "Keep board confidence high through results, wages, and renewals.",
      "Develop your squad via reserves, transfers, and matchday form.",
    ],
    confidenceNote: `The board start at ${career.boardConfidence}% confidence. Hit your target at season's end to earn rewards and protect your job.`,
  };
}
