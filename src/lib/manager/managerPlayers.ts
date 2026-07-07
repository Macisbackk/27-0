import type { Position, Player } from "../types";
import type { ManagerCareer, ManagerReservePlayer, RetiredPlayer } from "./types";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import { getAgeAtYear, resolveBirthYear } from "../players/player-age";

import { computePlayerValue, syncPlayerValueFromRating } from "../players/ratings";
import { applyManagerModeRatingToPlayer } from "./managerSquadRatings";

function withDevelopmentRating(player: Player, devRating: number): Player {
  return syncPlayerValueFromRating({
    ...player,
    peakRating: devRating,
  });
}

function hydratePlayerBirthData(player: Player): Player {
  const birthYear = resolveBirthYear(
    player.birthYear,
    player.dateOfBirth,
    player.yearsActive
  );
  if (birthYear !== undefined) {
    return birthYear === player.birthYear
      ? player
      : { ...player, birthYear };
  }

  const canonical = getPlayerById(player.id);
  if (!canonical) return player;

  const canonicalBirthYear = resolveBirthYear(
    canonical.birthYear,
    canonical.dateOfBirth,
    canonical.yearsActive
  );
  if (canonicalBirthYear === undefined) return player;

  return {
    ...player,
    birthYear: canonicalBirthYear,
    dateOfBirth: player.dateOfBirth ?? canonical.dateOfBirth,
  };
}

export function reserveToPlayer(
  reserve: ManagerReservePlayer,
  seasonYear = new Date().getFullYear()
): Player {
  const birthYear = seasonYear - reserve.age;
  return applyManagerModeRatingToPlayer({
    id: reserve.id,
    name: reserve.name,
    position: reserve.position,
    peakRating: reserve.rating,
    category: "current",
    club: "",
    value: computePlayerValue(reserve.rating, reserve.position, "current"),
    nationality: reserve.nationality,
    birthYear,
    yearsActive: `${birthYear}–`,
    intlCaps: 0,
  });
}

export function getManagerPlayer(
  career: ManagerCareer,
  playerId: string
): Player | undefined {
  const reserve = career.reserves?.find((r) => r.id === playerId);
  if (reserve) return reserveToPlayer(reserve, career.seasonYear);
  const generated = career.playerRegistry?.[playerId];
  if (generated) {
    const dev = career.playerDevelopment?.[playerId];
    const rated = applyManagerModeRatingToPlayer(
      hydratePlayerBirthData(generated)
    );
    if (dev) {
      return withDevelopmentRating(rated, dev.rating);
    }
    return rated;
  }
  const base = getPlayerById(playerId);
  const dev = career.playerDevelopment?.[playerId];
  if (base && dev) {
    return withDevelopmentRating(applyManagerModeRatingToPlayer(base), dev.rating);
  }
  const player = base;
  if (!player) return undefined;
  return applyManagerModeRatingToPlayer(hydratePlayerBirthData(player));
}

/** In-game age for manager mode — uses career season year, not the real-world calendar. */
export function getManagerPlayerAge(
  career: ManagerCareer,
  playerId: string
): number | undefined {
  const reserve = career.reserves?.find((r) => r.id === playerId);
  if (reserve) return reserve.age;

  const player = getManagerPlayer(career, playerId);
  if (!player) return undefined;

  return getAgeAtYear(player, career.seasonYear);
}

/** Recompute retirement age for display (fixes stale saves with bad birth data). */
export function getRetiredPlayerDisplayAge(
  career: ManagerCareer,
  record: RetiredPlayer
): number {
  const player =
    getPlayerById(record.playerId) ?? career.playerRegistry[record.playerId];
  if (player) {
    const age = getAgeAtYear(player, record.seasonRetired);
    if (age !== undefined && age >= 16 && age <= 50) return age;
  }
  return record.age;
}

export function getManagerPlayerEligiblePositions(
  career: ManagerCareer,
  playerId: string
): Position[] {
  const reserve = career.reserves?.find((r) => r.id === playerId);
  if (reserve) {
    const base = getPlayerEligiblePositions(
      reserveToPlayer(reserve, career.seasonYear)
    );
    const learned = career.playerLearnedPositions[playerId] ?? [];
    if (learned.length === 0) return base;
    return [...new Set([...base, ...learned])];
  }
  const player = getManagerPlayer(career, playerId);
  if (!player) return [];
  const base = getPlayerEligiblePositions(player);
  const learned = career.playerLearnedPositions[playerId] ?? [];
  if (learned.length === 0) return base;
  return [...new Set([...base, ...learned])];
}

export function isReservePlayerId(
  career: ManagerCareer,
  playerId: string
): boolean {
  return career.reserves.some((r) => r.id === playerId);
}

export function isCalledUpReserve(
  career: ManagerCareer,
  playerId: string
): boolean {
  return career.calledUpReserveIds.includes(playerId);
}
