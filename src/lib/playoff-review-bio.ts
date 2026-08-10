import type { PlayoffResult } from "./game/playoff-simulation";

const CHAMPION_BIOS = [
  "Champions when it mattered.",
  "Playoffs sealed. Champions.",
  "Finished the job.",
  "Playoff glory.",
] as const;

const GRAND_FINAL_LOSS_BIOS = [
  "One win short.",
  "Fell at the final hurdle.",
  "Heartbreak in the Grand Final.",
  "So close to silverware.",
] as const;

const SEMI_FINAL_LOSS_BIOS = [
  "Out in the semi-final.",
  "Faded under playoff pressure.",
  "Quality there — final step missing.",
  "Semi-final exit.",
] as const;

const EARLY_EXIT_BIOS = [
  "Playoff run never caught fire.",
  "Quick exit. Unfinished business.",
  "League form. Playoff fade.",
  "One bad night ended it.",
] as const;

const LEAGUE_WINNER_BIOS = [
  "League winners.",
  "Top of the table. Deserved.",
  "Set the regular-season standard.",
  "League title. Built on consistency.",
] as const;

function pickBio(pool: readonly string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length]!;
}

/** Short bio under the playoff review title. */
export function getPlayoffReviewBio(
  playoffResult: PlayoffResult,
  seasonWins: number
): string {
  const seed =
    playoffResult.wins * 17 +
    playoffResult.losses * 13 +
    playoffResult.leaguePosition * 7 +
    seasonWins;

  if (playoffResult.isChampion) {
    return pickBio(CHAMPION_BIOS, seed);
  }
  if (playoffResult.finish === "Grand Final Runner-Up") {
    return pickBio(GRAND_FINAL_LOSS_BIOS, seed);
  }
  if (playoffResult.finish === "Eliminated in Semi-Final") {
    return pickBio(SEMI_FINAL_LOSS_BIOS, seed);
  }
  if (playoffResult.leaguePosition === 1) {
    return pickBio(LEAGUE_WINNER_BIOS, seed);
  }
  return pickBio(EARLY_EXIT_BIOS, seed);
}
