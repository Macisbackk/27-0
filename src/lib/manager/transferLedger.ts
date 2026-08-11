/**
 * Shared transfer ledger: idempotency, canonical history, listing market sync.
 * Safe to import from movers (no cycles with transferTransactions).
 */
import { isSameManagerClub } from "../clubs/super-league-display";
import type {
  LeagueListedPlayer,
  LeagueTransferActivity,
  ManagerCareer,
  TransferListingType,
} from "./types";
import { resolveTransferListingType } from "./managerTransferLeague";

const PROCESSED_TX_CAP = 80;
const LEAGUE_TRANSFER_CAP = 48;

export function wasTransferTxProcessed(
  career: ManagerCareer,
  txId: string
): boolean {
  return (career.processedTransferTxIds ?? []).includes(txId);
}

export function markTransferTxProcessed(
  career: ManagerCareer,
  txId: string
): ManagerCareer {
  const prev = career.processedTransferTxIds ?? [];
  if (prev.includes(txId)) return career;
  return {
    ...career,
    processedTransferTxIds: [txId, ...prev].slice(0, PROCESSED_TX_CAP),
    updatedAt: new Date().toISOString(),
  };
}

export function syncDerivedTransferMarket(
  career: ManagerCareer
): ManagerCareer {
  return {
    ...career,
    transferMarket: career.leagueListedPlayers.map((row) => row.playerId),
  };
}

/** Push or refresh the user's listing into the shared league market list. */
export function syncUserListingToLeagueMarket(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const status = career.playerTransferStatus[playerId];
  if (!status?.listed) {
    return removePlayerFromLeagueMarket(career, playerId, career.club);
  }

  const listingType = resolveTransferListingType(status.listingType);
  const row: LeagueListedPlayer = {
    playerId,
    club: career.club,
    askingPrice: listingType === "loan" ? 0 : status.askingPrice,
    listedAtWeek: status.listedAtGameWeek,
    listingType,
  };

  const without = career.leagueListedPlayers.filter(
    (l) =>
      l.playerId !== playerId || !isSameManagerClub(l.club, career.club)
  );

  return syncDerivedTransferMarket({
    ...career,
    leagueListedPlayers: [row, ...without],
  });
}

export function removePlayerFromLeagueMarket(
  career: ManagerCareer,
  playerId: string,
  club?: string
): ManagerCareer {
  const leagueListedPlayers = career.leagueListedPlayers.filter((l) => {
    if (l.playerId !== playerId) return true;
    if (!club) return false;
    return !isSameManagerClub(l.club, club);
  });
  return syncDerivedTransferMarket({ ...career, leagueListedPlayers });
}

export function clearAllMarketPresenceForPlayer(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const nextStatus = { ...career.playerTransferStatus };
  delete nextStatus[playerId];
  return syncDerivedTransferMarket({
    ...career,
    playerTransferStatus: nextStatus,
    leagueListedPlayers: career.leagueListedPlayers.filter(
      (l) => l.playerId !== playerId
    ),
  });
}

export function appendCanonicalTransferActivity(
  career: ManagerCareer,
  activity: LeagueTransferActivity
): ManagerCareer {
  const existing = career.leagueTransfers ?? [];
  if (existing.some((row) => row.id === activity.id)) {
    return career;
  }
  return {
    ...career,
    leagueTransfers: [activity, ...existing].slice(0, LEAGUE_TRANSFER_CAP),
  };
}

export function buildTransferActivity(params: {
  id: string;
  career: ManagerCareer;
  playerId: string;
  playerName: string;
  fromClub: string;
  toClub: string;
  fee: number;
  transferType: NonNullable<LeagueTransferActivity["transferType"]>;
  sourceSquad?: LeagueTransferActivity["sourceSquad"];
}): LeagueTransferActivity {
  return {
    id: params.id,
    week: params.career.gameWeek,
    playerId: params.playerId,
    playerName: params.playerName,
    fromClub: params.fromClub,
    toClub: params.toClub,
    fee: params.fee,
    transferType: params.transferType,
    sourceSquad: params.sourceSquad ?? "senior",
  };
}

/** Ensure prune keeps user listings that still match playerTransferStatus. */
export function mergeUserListingsIntoLeagueMarket(
  career: ManagerCareer
): ManagerCareer {
  let next = career;
  for (const [playerId, status] of Object.entries(career.playerTransferStatus)) {
    if (!status.listed) continue;
    next = syncUserListingToLeagueMarket(next, playerId);
  }
  return next;
}

export function listingTypeLabel(
  listingType?: TransferListingType | null
): string {
  const t = resolveTransferListingType(listingType);
  if (t === "loan") return "AVAILABLE ON LOAN";
  if (t === "both") return "LISTED · LOAN OK";
  return "TRANSFER LISTED";
}
