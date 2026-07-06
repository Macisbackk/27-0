import type { PlayoffResult } from "./playoff-simulation";

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
