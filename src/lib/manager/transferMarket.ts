/**
 * Transfer market read helpers — resolve authoritative players for listings/UI.
 * All writes go through transferTransactions.ts.
 */
import { getPlayerById } from "../players";
import type { ManagerCareer } from "./types";
import type { Player } from "../types";
import { getManagerPlayer } from "./managerPlayers";
import { getPlayerMarketAvailability } from "./transferEligibility";
import { syncDerivedTransferMarket } from "./transferLedger";

/** Resolve one market player by stable ID (registry + static chunks). */
export function resolveMarketPlayer(
  career: ManagerCareer,
  playerId: string
): Player | null {
  return getManagerPlayer(career, playerId) ?? getPlayerById(playerId) ?? null;
}

export function playerUnavailableMessage(
  career: ManagerCareer,
  playerId: string,
  intent: "buy" | "loan" | "free" = "buy"
): string {
  const player = resolveMarketPlayer(career, playerId);
  if (!player) {
    return "This player is no longer available.";
  }
  const availability = getPlayerMarketAvailability(career, playerId);
  if (!availability.availableForTransfer && intent !== "loan") {
    return "This player is no longer available.";
  }
  if (!availability.availableForLoan && intent === "loan") {
    return "This player is no longer available for loan.";
  }
  if (!availability.obtainableForBuy && intent === "buy") {
    return availability.obtainableReason ?? "The player is not eligible for this club.";
  }
  if (!availability.obtainableForLoan && intent === "loan") {
    return availability.obtainableReason ?? "The player is not eligible for this club.";
  }
  return "This player is no longer available.";
}

/** Ensure derived transferMarket mirrors leagueListedPlayers + user listings. */
export function normalizeTransferMarketState(
  career: ManagerCareer
): ManagerCareer {
  const watch = [...new Set(career.transferWatchlistIds ?? [])];
  return syncDerivedTransferMarket({ ...career, transferWatchlistIds: watch });
}
