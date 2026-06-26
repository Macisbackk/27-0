import type { ChallengeCupResult } from "./challenge-cup-simulation";
import type { PlayoffResult } from "./playoff-simulation";

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

const POT_PLAYOFF_LINES = [
  "Delivered when the play-offs mattered most.",
  "The standout performer across the knockout run.",
  "Produced match-winning moments in the play-offs.",
  "Rose to the occasion in the biggest games of the series.",
  "Set the standard throughout the play-off campaign.",
];

const WORST_PLAYOFF_LINES = [
  "Failed to make an impact in the knockout rounds.",
  "A quiet play-off campaign when the squad needed more.",
  "Struggled to influence the biggest matches of the run.",
  "Below the level expected across the play-offs.",
  "Never quite found form during the knockout series.",
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

export function getPlayoffPotyNarrative(
  result: PlayoffResult,
  playerName: string
): string {
  const idx =
    (result.wins + result.userFixtures.length + playerName.length) %
    POT_PLAYOFF_LINES.length;
  return POT_PLAYOFF_LINES[idx];
}

export function getPlayoffWorstNarrative(
  result: PlayoffResult,
  playerName: string
): string {
  const idx =
    (result.losses + playerName.length) % WORST_PLAYOFF_LINES.length;
  return WORST_PLAYOFF_LINES[idx];
}
