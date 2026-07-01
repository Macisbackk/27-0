import { getPlayerById } from "../players";
import { getPlayerAge } from "../players/player-age";
import type { ManagerCareer, PlayerDevelopmentState } from "./types";
import { getManagerPlayer } from "./managerPlayers";

function computePotential(
  peakRating: number,
  age: number
): number {
  if (age <= 21) return Math.min(95, peakRating + 8);
  if (age <= 24) return Math.min(92, peakRating + 5);
  if (age <= 27) return Math.min(90, peakRating + 2);
  if (age <= 30) return peakRating;
  return Math.max(65, peakRating - 3);
}

export function developSquadAtSeasonEnd(career: ManagerCareer): ManagerCareer {
  const playerDevelopment: Record<string, PlayerDevelopmentState> = {
    ...(career.playerDevelopment ?? {}),
  };

  for (const ps of career.squad) {
    const base = getPlayerById(ps.playerId);
    if (!base) continue;

    const age = getPlayerAge(base) ?? 25;
    const existing = playerDevelopment[ps.playerId];
    const currentRating =
      existing?.rating ?? base.rating ?? base.peakRating;
    const potential =
      existing?.potential ?? computePotential(base.peakRating, age);

    let delta = 0;
    if (age <= 22) delta += 1;
    else if (age >= 33) delta -= 1;
    else if (age >= 30) delta -= 0.5;

    if (ps.seasonAppearances >= 18) delta += 1.5;
    else if (ps.seasonAppearances >= 10) delta += 0.5;
    else if (ps.seasonAppearances < 4) delta -= 1;

    if (ps.seasonTries >= 12) delta += 1;
    else if (ps.seasonTries >= 6) delta += 0.5;

    if (ps.form >= 70) delta += 1;
    else if (ps.form >= 58) delta += 0.5;
    else if (ps.form < 42) delta -= 1;

    const rounded = Math.round(delta);
    const newRating = Math.max(
      55,
      Math.min(potential, currentRating + rounded)
    );
    const newPeak = Math.max(
      existing?.peakRating ?? base.peakRating,
      newRating,
      base.peakRating
    );

    playerDevelopment[ps.playerId] = {
      rating: newRating,
      peakRating: newPeak,
      potential,
    };
  }

  return { ...career, playerDevelopment };
}

export function getPlayerPotential(
  career: ManagerCareer,
  playerId: string
): number | null {
  const dev = career.playerDevelopment?.[playerId];
  if (dev) return dev.potential;
  const player = getManagerPlayer(career, playerId);
  if (!player) return null;
  return computePotential(player.peakRating, getPlayerAge(player) ?? 25);
}
