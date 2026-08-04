import currentSquads from "../../../data/current-squads.json";
import { PLAYER_RATING_OVERRIDES } from "../../../data/player-rating-overrides";
import type { Player } from "../types";
import { syncPlayerValueFromRating } from "../players/ratings";

/**
 * Canonical manager-mode ratings: current-squads peakRating, then explicit overrides.
 * Do not use stale SL-2026 apply-report numbers after the v3 (floor-80) rebalance.
 */
const MANAGER_RATING_BY_PLAYER_ID = new Map<string, number>();

function buildManagerRatingMap(): void {
  for (const raw of currentSquads as { id: string; peakRating: number }[]) {
    if (typeof raw.peakRating === "number") {
      MANAGER_RATING_BY_PLAYER_ID.set(raw.id, raw.peakRating);
    }
  }
  for (const [id, rating] of Object.entries(PLAYER_RATING_OVERRIDES)) {
    MANAGER_RATING_BY_PLAYER_ID.set(id, rating);
  }
}

buildManagerRatingMap();

/** 2026 Super League squad ratings for manager mode display and strength. */
export function getManagerModePlayerRating(
  playerId: string,
  _playerName: string,
  fallback: number
): number {
  const byId = MANAGER_RATING_BY_PLAYER_ID.get(playerId);
  if (byId !== undefined) return byId;
  return fallback;
}

export function hasManagerModeRating(playerId: string): boolean {
  return MANAGER_RATING_BY_PLAYER_ID.has(playerId);
}

export function applyManagerModeRatingToPlayer(player: Player): Player {
  let next = player;
  if (hasManagerModeRating(player.id)) {
    const mgrRating = MANAGER_RATING_BY_PLAYER_ID.get(player.id)!;
    // Prefer canonical rebalanced rating (not max with a stale save copy).
    if (mgrRating !== player.peakRating) {
      next = { ...player, peakRating: mgrRating };
    }
  }
  return syncPlayerValueFromRating(next);
}

export function getManagerClubKeyPlayers(
  playerIds: string[],
  getRating: (id: string) => number,
  getName: (id: string) => string,
  limit = 5
): { playerId: string; name: string; rating: number }[] {
  return playerIds
    .map((id) => ({
      playerId: id,
      name: getName(id),
      rating: getRating(id),
    }))
    .filter((p) => p.rating > 0 && p.name)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
