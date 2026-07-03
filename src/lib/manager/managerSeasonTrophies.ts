import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import { getUserLeagueTablePosition } from "./managerFixtures";
import type { ManagerCareer } from "./types";

/** Trophies earned in a season for display (League Leaders can coexist with SL Champions). */
export function getManagerSeasonTrophyLabels(career: ManagerCareer): string[] {
  const trophies: string[] = [];
  const position = getUserLeagueTablePosition(career);
  const playoffFinish = career.playoffs?.finish ?? null;
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  const leaguePhaseComplete = isLeagueAndCupPhaseComplete(career);

  if (leaguePhaseComplete && position === 1) {
    trophies.push("League Leaders");
  }
  if (career.isSeasonComplete && playoffFinish === "Super League Champions") {
    trophies.push("Super League Champions");
  }
  if (
    (career.isSeasonComplete || cupOutcome.isWinner) &&
    cupOutcome.isWinner
  ) {
    trophies.push("Challenge Cup");
  }
  if (career.isSeasonComplete && playoffFinish === "Grand Final Runner-Up") {
    trophies.push("Grand Final Runner-Up");
  }

  return trophies;
}
