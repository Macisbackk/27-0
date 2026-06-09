import type { ChallengeCupResult } from "./challenge-cup-simulation";

const POT_TOURNAMENT_LINES = [
  "Consistently delivered in the biggest moments.",
  "The driving force behind the cup run.",
  "Produced match-winning performances throughout the tournament.",
  "Rose to the occasion whenever the knockout stakes were highest.",
  "Set the standard in every round of the campaign.",
];

const WORST_POT_LINES = [
  "Struggled to influence key matches.",
  "Never quite found form during the competition.",
  "A difficult tournament campaign.",
  "Failed to make an impact when the squad needed it most.",
  "Below the level expected across the knockout rounds.",
];

export function getTournamentPotyNarrative(
  result: ChallengeCupResult,
  playerName: string
): string {
  const idx =
    (result.matchesPlayed + playerName.length) % POT_TOURNAMENT_LINES.length;
  return POT_TOURNAMENT_LINES[idx];
}

export function getTournamentWorstNarrative(
  result: ChallengeCupResult,
  playerName: string
): string {
  const idx =
    (result.losses + playerName.length) % WORST_POT_LINES.length;
  return WORST_POT_LINES[idx];
}
