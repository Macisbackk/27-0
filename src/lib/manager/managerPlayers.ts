import type { Position, Player } from "../types";
import type { ManagerCareer, ManagerReservePlayer } from "./types";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";

export function reserveToPlayer(reserve: ManagerReservePlayer): Player {
  return {
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
  };
}

export function getManagerPlayer(
  career: ManagerCareer,
  playerId: string
): Player | undefined {
  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve) return reserveToPlayer(reserve);
  const generated = career.playerRegistry[playerId];
  if (generated) return generated;
  return getPlayerById(playerId);
}

export function getManagerPlayerEligiblePositions(
  career: ManagerCareer,
  playerId: string
): Position[] {
  const reserve = career.reserves.find((r) => r.id === playerId);
  if (reserve) return reserve.eligiblePositions;
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
