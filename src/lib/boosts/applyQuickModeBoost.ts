import type { Player, Position } from "../types";
import { isHiddenPlayer, isGoatPlayer } from "../players/goat";
import type { GameBoostId } from "./boostDefinitions";

/** Hall of Fame / GOAT-tier eligibility for Quick Mode boost (excludes JM Easter egg GOAT). */
export function isGoatOrHallOfFamePlayer(player: Player): boolean {
  if (isGoatPlayer(player) || isHiddenPlayer(player)) return false;
  if (player.category === "legend") return true;
  if (player.hallOfFame === true) return true;
  return false;
}

export function isNinetyPlusPlayer(player: Player): boolean {
  return player.peakRating >= 90;
}

export function playerMatchesSelectionBoost(
  player: Player,
  boostId: GameBoostId
): boolean {
  if (boostId === "qm-90-plus-player") return isNinetyPlusPlayer(player);
  if (boostId === "qm-goat-hall-of-fame") return isGoatOrHallOfFamePlayer(player);
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
          : "No eligible GOAT or Hall of Fame player is available for this selection.",
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
