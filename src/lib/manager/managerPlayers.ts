import type { Position, Player } from "../types";
import type { ManagerCareer, ManagerReservePlayer } from "./types";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";

import {
  applyManagerModeRatingToPlayer,
} from "./managerSquadRatings";

export function reserveToPlayer(reserve: ManagerReservePlayer): Player {
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
    birthYear: new Date().getFullYear() - reserve.age,
    yearsActive: `${new Date().getFullYear() - reserve.age}–`,
    intlCaps: 0,
  });
}

export function getManagerPlayer(
  career: ManagerCareer,
  playerId: string
): Player | undefined {
  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve) return reserveToPlayer(reserve);
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

export function getManagerPlayerEligiblePositions(
  career: ManagerCareer,
  playerId: string
): Position[] {
  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve) return getPlayerEligiblePositions(reserveToPlayer(reserve));
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
