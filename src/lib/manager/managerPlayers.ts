import type { Position, Player } from "../types";
import type { ManagerCareer, ManagerReservePlayer, RetiredPlayer } from "./types";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import { getAgeAtYear } from "../players/player-age";

import {
  applyManagerModeRatingToPlayer,
} from "./managerSquadRatings";

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
    rating: reserve.rating,
    category: "current",
    club: "",
    value: reserve.rating * 5000,
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
  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve) return reserveToPlayer(reserve, career.seasonYear);
  const generated = career.playerRegistry[playerId];
  if (generated) return applyManagerModeRatingToPlayer(generated);
  const base = getPlayerById(playerId);
  const dev = career.playerDevelopment?.[playerId];
  if (base && dev) {
    return {
      ...applyManagerModeRatingToPlayer(base),
      rating: dev.rating,
      peakRating: dev.peakRating,
    };
  }
  const player = base;
  if (!player) return undefined;
  return applyManagerModeRatingToPlayer(player);
}

/** In-game age for manager mode — uses career season year, not the real-world calendar. */
export function getManagerPlayerAge(
  career: ManagerCareer,
  playerId: string
): number | undefined {
  const reserve = career.reserves.find((r) => r.id === playerId);
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
  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve) {
    return getPlayerEligiblePositions(
      reserveToPlayer(reserve, career.seasonYear)
    );
  }
  const player = getManagerPlayer(career, playerId);
  if (!player) return [];
  return getPlayerEligiblePositions(player);
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
