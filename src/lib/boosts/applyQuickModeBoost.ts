import type { Player, Position } from "../types";
import { isHiddenPlayer, isGoatPlayer } from "../players/goat";
import type { GameBoostId } from "./boostDefinitions";
import { getBoostDefinition } from "./boostDefinitions";

/**
 * Legend boost eligibility (excludes JM Easter egg GOAT).
 * Named historically as GOAT/HOF; Store label is now Legend Player.
 */
export function isLegendBoostPlayer(player: Player): boolean {
  if (isGoatPlayer(player) || isHiddenPlayer(player)) return false;
  return player.category === "legend";
}

/** @deprecated Prefer isLegendBoostPlayer */
export function isGoatOrHallOfFamePlayer(player: Player): boolean {
  return isLegendBoostPlayer(player);
}

export function isNinetyPlusPlayer(player: Player): boolean {
  return player.peakRating >= 90;
}

export function isQmLegendBoostId(boostId: GameBoostId): boolean {
  return boostId === "qm-goat-hall-of-fame";
}

/** Whether a Quick Mode selection boost can be used in the active mode variant. */
export function isQmSelectionBoostAllowedInMode(
  boostId: GameBoostId,
  eraMode: boolean
): boolean {
  const def = getBoostDefinition(boostId);
  if (!def || def.category !== "quick-mode") return false;
  if (def.eraModeOnly && !eraMode) return false;
  return true;
}

export function playerMatchesSelectionBoost(
  player: Player,
  boostId: GameBoostId
): boolean {
  if (boostId === "qm-90-plus-player") return isNinetyPlusPlayer(player);
  if (boostId === "qm-goat-hall-of-fame") return isLegendBoostPlayer(player);
  return false;
}

export function selectionHasBoostedPlayer(
  players: Player[],
  boostId: GameBoostId
): boolean {
  return players.some((p) => playerMatchesSelectionBoost(p, boostId));
}

/**
 * Ensure a pair contains at least one boosted candidate.
 * Guaranteed player is picked from eligibleBoosted; other from remaining pool.
 */
export function buildBoostedPair(input: {
  boostId: GameBoostId;
  eligiblePool: Player[];
  usedIds: Set<string>;
  position?: Position;
  pickRandom: <T>(items: T[]) => T | null;
}): { pair: [Player, Player] | null; reason?: string } {
  const { boostId, eligiblePool, usedIds, pickRandom } = input;
  const available = eligiblePool.filter((p) => !usedIds.has(p.id));

  const boosted = available.filter((p) =>
    playerMatchesSelectionBoost(p, boostId)
  );
  if (boosted.length === 0) {
    return {
      pair: null,
      reason:
        boostId === "qm-90-plus-player"
          ? "No eligible 90+ player is available for this selection."
          : "No eligible Legend player is available for this selection.",
    };
  }

  const guaranteed = pickRandom(boosted);
  if (!guaranteed) {
    return { pair: null, reason: "Could not select a boosted player." };
  }

  const others = available.filter((p) => p.id !== guaranteed.id);
  if (others.length === 0) {
    return {
      pair: null,
      reason: "Not enough eligible players to form a choice.",
    };
  }

  const partner = pickRandom(others);
  if (!partner) {
    return { pair: null, reason: "Not enough eligible players to form a choice." };
  }

  // Randomise display order so the boost is not always option A.
  return Math.random() < 0.5
    ? { pair: [guaranteed, partner] }
    : { pair: [partner, guaranteed] };
}
