/**
 * Canonical player registration read model for Manager Mode transfers.
 * Ownership/registration stay in existing career bags; this derives one view.
 */
import { isSameManagerClub } from "../clubs/super-league-display";
import type {
  ManagerCareer,
  TransferListingType,
} from "./types";
import {
  findPlayerLeagueClub,
  getUserClubPlayerIds,
} from "./managerLeagueRosters";
import { getActiveLoan } from "./managerLoans";
import { isFreeAgent } from "./managerFreeAgents";

export type SquadStatus = "FIRST_TEAM" | "RESERVES" | "YOUTH" | "UNATTACHED";
export type RegistrationType = "PERMANENT" | "LOAN";

export type PlayerRegistration = {
  playerId: string;
  /** Permanent owner (loan parent, or current club). Null if free agent / unknown. */
  owningClubId: string | null;
  /** Club where the player currently plays. Null if free agent / unattached. */
  playingClubId: string | null;
  squadStatus: SquadStatus;
  registrationType: RegistrationType;
  loanParentClubId?: string;
  loanEndsAtSeasonYear?: number;
  listingType?: TransferListingType | null;
  transferRequested?: boolean;
  freeAgent?: boolean;
};

function userSquadStatus(
  career: ManagerCareer,
  playerId: string
): SquadStatus | null {
  if (career.squad.some((p) => p.playerId === playerId)) return "FIRST_TEAM";
  if ((career.reserves ?? []).some((r) => r.id === playerId)) return "RESERVES";
  if ((career.youthProspects ?? []).some((y) => y.id === playerId)) return "YOUTH";
  return null;
}

/**
 * One authoritative registration snapshot for a player in this career world.
 */
export function getPlayerRegistration(
  career: ManagerCareer,
  playerId: string
): PlayerRegistration {
  const loan = getActiveLoan(career, playerId);
  const freeAgent = isFreeAgent(career, playerId);
  const userStatus = userSquadStatus(career, playerId);
  const playingFromMap = findPlayerLeagueClub(career, playerId);

  let playingClubId: string | null = null;
  let squadStatus: SquadStatus = "UNATTACHED";

  if (freeAgent) {
    playingClubId = null;
    squadStatus = "UNATTACHED";
  } else if (userStatus) {
    playingClubId = career.club;
    squadStatus = userStatus;
  } else if (playingFromMap) {
    playingClubId = playingFromMap;
    squadStatus = "FIRST_TEAM";
  } else if (loan && isSameManagerClub(loan.parentClub, career.club)) {
    // Loaned out of user squad — still owned, playing elsewhere.
    playingClubId = loan.loaneeClub;
    squadStatus = "FIRST_TEAM";
  }

  const owningClubId = loan
    ? loan.parentClub
    : freeAgent
      ? null
      : playingClubId;

  const userListing = career.playerTransferStatus[playerId];
  const leagueListing = career.leagueListedPlayers.find(
    (row) => row.playerId === playerId
  );
  const listingType =
    userListing?.listed
      ? userListing.listingType ?? "permanent"
      : leagueListing?.listingType ?? null;

  return {
    playerId,
    owningClubId,
    playingClubId,
    squadStatus,
    registrationType: loan ? "LOAN" : "PERMANENT",
    loanParentClubId: loan?.parentClub,
    loanEndsAtSeasonYear: loan?.endsAtSeasonYear,
    listingType,
    transferRequested: Boolean(userListing?.transferRequested),
    freeAgent,
  };
}

/** Players the user owns who are away on loan (not in selectable squad). */
export function listUserLoanedOutPlayers(career: ManagerCareer): Array<{
  playerId: string;
  loaneeClub: string;
  endsAtSeasonYear: number;
  parentWageShare: number;
}> {
  return (career.activeLoans ?? [])
    .filter(
      (loan) =>
        isSameManagerClub(loan.parentClub, career.club) &&
        !isSameManagerClub(loan.loaneeClub, career.club)
    )
    .map((loan) => ({
      playerId: loan.playerId,
      loaneeClub: loan.loaneeClub,
      endsAtSeasonYear: loan.endsAtSeasonYear,
      parentWageShare: loan.parentWageShare,
    }));
}

/** True when the user owns this player (including loaned-out). */
export function isOwnedByUserClub(
  career: ManagerCareer,
  playerId: string
): boolean {
  const reg = getPlayerRegistration(career, playerId);
  return (
    reg.owningClubId != null &&
    isSameManagerClub(reg.owningClubId, career.club)
  );
}

/** Selectable first-team pool excludes loaned-out players (already off squad). */
export function getUserSelectableFirstTeamIds(career: ManagerCareer): Set<string> {
  return new Set(career.squad.map((p) => p.playerId));
}

/** Debug helper — user-owned set including loaned-out. */
export function getUserOwnedPlayerIds(career: ManagerCareer): Set<string> {
  const ids = getUserClubPlayerIds(career);
  for (const loan of career.activeLoans ?? []) {
    if (isSameManagerClub(loan.parentClub, career.club)) {
      ids.add(loan.playerId);
    }
  }
  return ids;
}
