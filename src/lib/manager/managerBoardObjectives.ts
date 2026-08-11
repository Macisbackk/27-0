import type { ManagerClubExpectationTier } from "./club-config";
import type { ManagerCareer, ManagerCompetitionId } from "./types";
import {
  getCareerClubStars,
  getCareerExpectationTier,
} from "./managerDifficulty";
import { getUserCompetitionId } from "./leagueMembership";

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
  tier: ManagerClubExpectationTier,
  competition: ManagerCompetitionId = "super-league"
): string {
  if (competition === "championship") {
    switch (tier) {
      case "title":
        return "Win the Championship for automatic promotion. Positions 2–5 enter the Million Pound Game route.";
      case "top":
        return "Finish first for automatic promotion, or 2nd–5th to reach the Championship play-offs.";
      case "playoffs":
        return "Finish 2nd–5th to reach the Championship play-offs.";
      case "mid-table":
        return "Finish mid-table or higher.";
      case "avoid-bottom":
      case "survive":
        return "Stay clear of the bottom.";
    }
  }
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
      return "Finish 11th or higher to avoid the Million Pound Game.";
  }
}

export function getManagerBoardObjectiveIntro(
  career: ManagerCareer
): ManagerBoardObjectiveIntro {
  const tier = getCareerExpectationTier(career);
  const stars = getCareerClubStars(career);
  const competition = getUserCompetitionId(career);
  const inChamp = competition === "championship";

  return {
    club: career.club,
    seasonYear: career.seasonYear,
    stars,
    primaryObjective: career.boardExpectation,
    successDetail: getBoardObjectiveSuccessDetail(tier, competition),
    secondaryAims: inChamp
      ? ["Earn promotion", "Championship play-offs", "Build the squad"]
      : ["Challenge Cup run", "Control wages", "Build the squad"],
    confidenceNote: `${career.boardConfidence}% confidence · hit ${career.boardExpectation}.`,
  };
}
