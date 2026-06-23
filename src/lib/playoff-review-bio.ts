import type { PlayoffResult } from "./game/playoff-simulation";

const CHAMPION_BIOS = [
  "Champions when it mattered most.",
  "A perfect playoff run sealed the season.",
  "They finished the job on the biggest stage.",
  "From league pressure to playoff glory.",
] as const;

const GRAND_FINAL_LOSS_BIOS = [
  "One win short of the trophy.",
  "A brilliant run ended at the final hurdle.",
  "The season finished with heartbreak under the lights.",
  "So close to turning a strong year into silverware.",
] as const;

const SEMI_FINAL_LOSS_BIOS = [
  "The playoff charge ended in the semi-final.",
  "A strong season faded when the pressure rose.",
  "They had the quality, but not the final step.",
  "A semi-final exit ended the dream.",
] as const;

const EARLY_EXIT_BIOS = [
  "The playoff run never caught fire.",
  "A quick exit left unfinished business.",
  "The league campaign promised more than the playoffs delivered.",
  "One bad night ended the season.",
] as const;

const LEAGUE_WINNER_BIOS = [
  "League winners after a dominant campaign.",
  "Top of the table and deserved league winners.",
  "They set the standard across the regular season.",
  "A league-winning season built on consistency.",
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
