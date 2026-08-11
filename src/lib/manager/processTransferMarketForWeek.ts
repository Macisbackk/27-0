/**
 * Single weekly transfer-market processor (idempotent per gameWeek).
 */
import type { ManagerCareer } from "./types";
import {
  generateIncomingLoanOffers,
  generateIncomingTransferOffers,
  generateLeagueListedPlayers,
  generateUnsolicitedTransferOffers,
} from "./managerTransferLeague";
import { maybeChampionshipBidForSlReserves } from "./championshipBidForSlReserves";
import { maybeAiSignChampionshipElite } from "./championship/championshipAiTransfers";
import { maybeGenerateAiTransfers } from "./managerAiTransfers";
import { maybeAiSignFreeAgents } from "./managerFreeAgents";
import { getLeagueSeasonIndex } from "./managerLeagueSeason";
import { mergeUserListingsIntoLeagueMarket } from "./transferLedger";
import { maybeGenerateTransferRequests } from "./transferRequests";

/**
 * Run all transfer offer / AI move systems once for the current game week.
 * Safe to call multiple times in the same week — gated by lastTransferScanGameWeek.
 */
export function processTransferMarketForWeek(
  career: ManagerCareer
): ManagerCareer {
  if (career.gameWeek === (career.lastTransferScanGameWeek ?? -1)) {
    return career;
  }

  let next = career;
  next = maybeGenerateTransferRequests(next);
  next = generateIncomingTransferOffers(next);
  next = generateIncomingLoanOffers(next);
  next = generateUnsolicitedTransferOffers(next);
  next = maybeChampionshipBidForSlReserves(next);
  next = maybeAiSignChampionshipElite(next);

  next = maybeGenerateAiTransfers(next, 0);
  next = maybeAiSignFreeAgents(next, 0);
  const leagueSeasonIndex = getLeagueSeasonIndex(next);
  if (leagueSeasonIndex >= 1) {
    next = maybeGenerateAiTransfers(next, 1);
    next = maybeAiSignFreeAgents(next, 1);
  }
  if (leagueSeasonIndex >= 2) {
    next = maybeGenerateAiTransfers(next, 2);
    next = maybeAiSignFreeAgents(next, 2);
  }
  if (leagueSeasonIndex >= 4) {
    next = maybeGenerateAiTransfers(next, 3);
    next = maybeAiSignFreeAgents(next, 3);
  }

  const listRefreshEvery = leagueSeasonIndex >= 1 ? 2 : 3;
  if (next.gameWeek > 0 && next.gameWeek % listRefreshEvery === 0) {
    const refreshed = generateLeagueListedPlayers(
      next,
      next.seed,
      next.gameWeek
    );
    next = {
      ...next,
      leagueListedPlayers: refreshed,
      transferMarket: refreshed.map((l) => l.playerId),
    };
  }
  next = mergeUserListingsIntoLeagueMarket(next);

  return {
    ...next,
    lastTransferScanGameWeek: next.gameWeek,
    updatedAt: new Date().toISOString(),
  };
}
