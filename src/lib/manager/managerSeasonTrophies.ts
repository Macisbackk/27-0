import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import type { PlayoffFinish } from "../game/playoff-simulation";
import { isLeagueAndCupPhaseComplete } from "./managerChallengeCup";
import { getUserLeagueTablePosition } from "./managerFixtures";
import type { ManagerCareer, ManagerSeasonSummary } from "./types";

const TROPHY_ORDER = [
  "League Leaders",
  "Super League Champions",
  "Challenge Cup",
  "Grand Final Runner-Up",
] as const;

function orderTrophyLabels(trophies: string[]): string[] {
  const ordered: string[] = TROPHY_ORDER.filter((label) =>
    trophies.includes(label)
  );
  for (const label of trophies) {
    if (!ordered.includes(label)) ordered.push(label);
  }
  return ordered;
}

/** Derive trophy labels from stored season facts (backfills older saves). */
export function getSeasonSummaryTrophyLabels(
  summary: ManagerSeasonSummary
): string[] {
  const challengeCupWon =
    summary.trophies.includes("Challenge Cup") ||
    summary.challengeCupResult === "Challenge Cup Winners";

  return normalizeSeasonTrophyLabels({
    position: summary.position,
    playoffFinish: summary.playoffFinish ?? null,
    challengeCupWon,
    leagueTableSettled: true,
    existing: summary.trophies,
  });
}

function normalizeSeasonTrophyLabels(input: {
  position: number;
  playoffFinish: PlayoffFinish | null;
  challengeCupWon: boolean;
  leagueTableSettled: boolean;
  existing?: string[];
}): string[] {
  const trophies = [...(input.existing ?? [])];
  const add = (label: string) => {
    if (!trophies.includes(label)) trophies.push(label);
  };

  if (input.position === 1 && input.leagueTableSettled) {
    add("League Leaders");
  }
  if (input.playoffFinish === "Super League Champions") {
    add("Super League Champions");
  }
  if (input.challengeCupWon) {
    add("Challenge Cup");
  }
  if (input.playoffFinish === "Grand Final Runner-Up") {
    add("Grand Final Runner-Up");
  }

  return orderTrophyLabels(trophies);
}

/** Trophies earned in a season for display (League Leaders can coexist with SL Champions). */
export function getManagerSeasonTrophyLabels(career: ManagerCareer): string[] {
  const position = getUserLeagueTablePosition(career);
  const playoffFinish = career.playoffs?.finish ?? null;
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  const leaguePhaseComplete = isLeagueAndCupPhaseComplete(career);
  const leagueTableSettled =
    leaguePhaseComplete ||
    career.isSeasonComplete ||
    career.playoffsIntroAcknowledged ||
    career.playoffs != null;

  return normalizeSeasonTrophyLabels({
    position,
    playoffFinish,
    challengeCupWon: cupOutcome.isWinner,
    leagueTableSettled,
  });
}
