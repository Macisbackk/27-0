import type { Position } from "../types";
import { POSITION_TRY_WEIGHT } from "./try-weights";

/** Penalty multipliers when a player already has N tries in the same match (index = tries scored). */
const BACK_MULTI: number[] = [1, 0.44, 0.19, 0.075, 0.028, 0.01];
const HALF_MULTI: number[] = [1, 0.3, 0.12, 0.045, 0.016, 0.006];
const FORWARD_MULTI: number[] = [1, 0.16, 0.055, 0.018, 0.006, 0.002];

function getPositionTier(position: Position): "back" | "half" | "forward" {
  const tier = POSITION_TRY_WEIGHT[position];
  if (tier >= 10) return "back";
  if (tier >= 6) return "half";
  return "forward";
}

/**
 * Diminishing chance of scoring another try in the same match.
 * Backs: doubles possible; hat-tricks uncommon; 4–5 very rare.
 * Forwards: doubles occasional; 3+ extremely rare.
 */
export function getInMatchMultiTryMultiplier(
  triesAlreadyInMatch: number,
  position: Position,
  rating: number,
  seasonTriesSoFar: number,
  teamTriesInMatch: number
): number {
  if (triesAlreadyInMatch <= 0) return 1;

  const table =
    getPositionTier(position) === "back"
      ? BACK_MULTI
      : getPositionTier(position) === "half"
        ? HALF_MULTI
        : FORWARD_MULTI;

  const idx = Math.min(triesAlreadyInMatch, table.length - 1);
  let mult = table[idx];

  if (rating >= 92 && triesAlreadyInMatch === 1) mult *= 1.12;
  else if (rating >= 88 && triesAlreadyInMatch === 1) mult *= 1.06;

  if (triesAlreadyInMatch >= 3 && teamTriesInMatch <= 5) mult *= 0.82;
  if (triesAlreadyInMatch >= 4) mult *= 0.75;

  if (seasonTriesSoFar >= 18) mult *= 0.88;
  if (seasonTriesSoFar >= 24) mult *= 0.72;

  return mult;
}
