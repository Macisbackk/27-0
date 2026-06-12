import type { Player, Position } from "../types";
import { computePlayerValue } from "./ratings";

/** Super Sam Hallas Mode exclusive — never in public database. */
export const SAM_HALLAS_ID_PREFIX = "ssh-sam-hallas-";

export function isSuperSamHallasId(id: string): boolean {
  return id.startsWith(SAM_HALLAS_ID_PREFIX);
}

export function isSuperSamHallasPlayer(player: Player | string): boolean {
  const id = typeof player === "string" ? player : player.id;
  return isSuperSamHallasId(id);
}

/** Synthetic 99-rated Sam Hallas — Super Sam Hallas Mode only. */
export function createSuperSamHallasPlayer(
  slotIndex: number,
  slotPosition: Position
): Player {
  const peakRating = 99;
  return {
    id: `${SAM_HALLAS_ID_PREFIX}${slotIndex}`,
    name: "Sam Hallas",
    club: "Bradford Bulls",
    position: slotPosition,
    nationality: "English",
    yearsActive: "2020–Present",
    category: "current",
    peakRating,
    rating: peakRating,
    value: computePlayerValue(peakRating, slotPosition, "current"),
    tries: 0,
    intlCaps: 0,
  };
}

export function getSuperSamHallasPlayer(
  slotIndex: number,
  slotPosition: Position
): Player {
  return createSuperSamHallasPlayer(slotIndex, slotPosition);
}
