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
        return "Win the Championship or earn a playoff path.";
      case "top":
        return "Challenge for automatic promotion or the playoffs.";
      case "playoffs":
        return "Reach the Championship playoffs.";
      case "mid-table":
        return "Finish mid-table or higher.";
      case "avoid-bottom":
      case "survive":
        return "Stay clear of the bottom.";
    }
  }
  switch (tier) {
    case "title":
      return "Challenge for the Super League title.";
    case "top":
      return "Finish among the top clubs.";
    case "playoffs":
      return "Reach the playoffs.";
    case "mid-table":
      return "Secure a solid mid-table finish.";
    case "avoid-bottom":
    case "survive":
      return "Stay clear of the drop.";
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
    confidenceNote: `Primary target: ${career.boardExpectation}.`,
  };
}
