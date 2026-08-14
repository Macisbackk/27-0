/**
 * Single eligibility gate for transfer / loan / reserve / FA intents.
 */
import { isSameManagerClub } from "../clubs/super-league-display";
import type {
  ContractStatus,
  ManagerCareer,
  ManagerCompetitionId,
  TransferListingType,
} from "./types";
import { resolveClubCompetitionForCareer } from "./leagueMembership";
import { getContractStatus } from "./managerContracts";
import { getPlayerRegistration } from "./playerRegistration";
import {
  getProtectedTransferPlayerIds,
  listingAllowsLoan,
  listingAllowsPermanent,
  resolveTransferListingType,
} from "./managerTransferLeague";
import {
  canUserLoanInPlayers,
  canUserLoanOutPlayers,
  getActiveLoan,
  isValidLoanDirection,
} from "./managerLoans";
import { isFreeAgent } from "./managerFreeAgents";
import { DEFAULT_TRANSFER_ACTIVITY_CONFIG } from "./transferActivityConfig";

export type TransferIntent =
  | "permanent_buy"
  | "permanent_sell"
  | "loan_in"
  | "loan_out"
  | "list_permanent"
  | "list_loan"
  | "reserve_to_champ"
  | "free_agent_sign"
  | "release_to_fa";

export type TransferEligibility = {
  allowed: boolean;
  reason?: string;
  registration: ReturnType<typeof getPlayerRegistration>;
};

export type MarketSquadStatus = "FIRST_TEAM" | "RESERVE" | "FREE_AGENT";

export type PlayerMarketAvailability = {
  playerId: string;
  availableForTransfer: boolean;
  availableForLoan: boolean;
  currentClub: string | null;
  competition: ManagerCompetitionId | null;
  contractStatus: ContractStatus | null;
  squadStatus: MarketSquadStatus;
  transferListed: boolean;
  loanListed: boolean;
};

function marketSquadStatus(
  registration: ReturnType<typeof getPlayerRegistration>
): MarketSquadStatus {
  if (registration.freeAgent || registration.squadStatus === "UNATTACHED") {
    return "FREE_AGENT";
  }
  if (registration.squadStatus === "RESERVES" || registration.squadStatus === "YOUTH") {
    return "RESERVE";
  }
  return "FIRST_TEAM";
}

/** Authoritative market projection — UI lists and TX validation share this. */
export function getPlayerMarketAvailability(
  career: ManagerCareer,
  playerId: string
): PlayerMarketAvailability {
  const registration = getPlayerRegistration(career, playerId);
  const listing = career.leagueListedPlayers.find((row) => row.playerId === playerId);
  const listingType = listing?.listingType ?? registration.listingType ?? null;
  const currentClub = registration.playingClubId;
  const buy = getTransferEligibility(career, playerId, "permanent_buy", {
    fromClub: currentClub ?? undefined,
    listed: Boolean(listing && listingAllowsPermanent(listingType)),
    listingType,
  });
  const loan = getTransferEligibility(career, playerId, "loan_in", {
    fromClub: currentClub ?? undefined,
    listed: Boolean(listing && listingAllowsLoan(listingType)),
    listingType,
  });
  const fa = getTransferEligibility(career, playerId, "free_agent_sign");
  const contract = currentClub ? career.contracts[playerId] : undefined;
  return {
    playerId,
    availableForTransfer: buy.allowed || fa.allowed,
    availableForLoan: loan.allowed,
    currentClub,
    competition: currentClub
      ? resolveClubCompetitionForCareer(currentClub, career)
      : null,
    contractStatus: contract ? getContractStatus(contract) : null,
    squadStatus: marketSquadStatus(registration),
    transferListed: Boolean(listing && listingAllowsPermanent(listingType)),
    loanListed: Boolean(listing && listingAllowsLoan(listingType)),
  };
}

function hasPendingOfferFromClub(
  career: ManagerCareer,
  playerId: string,
  offerClub: string,
  loanOffer?: boolean
): boolean {
  return career.inboxMessages.some(
    (m) =>
      !m.resolved &&
      m.playerId === playerId &&
      m.offerClub != null &&
      isSameManagerClub(m.offerClub, offerClub) &&
      (loanOffer == null || Boolean(m.loanOffer) === loanOffer) &&
      (m.type === "transfer" || m.type === "transfer_offer_in")
  );
}

/** Soft heat gate — product has no hard closed window. */
export function transferMarketHeat(career: ManagerCareer): number {
  return DEFAULT_TRANSFER_ACTIVITY_CONFIG.gameWeekActivityMultiplier(
    career.gameWeek
  );
}

export function getTransferEligibility(
  career: ManagerCareer,
  playerId: string,
  intent: TransferIntent,
  opts?: {
    fromClub?: string;
    toClub?: string;
    listed?: boolean;
    listingType?: TransferListingType | null;
  }
): TransferEligibility {
  const registration = getPlayerRegistration(career, playerId);
  const loan = getActiveLoan(career, playerId);

  const deny = (reason: string): TransferEligibility => ({
    allowed: false,
    reason,
    registration,
  });
  const allow = (): TransferEligibility => ({
    allowed: true,
    registration,
  });

  if (intent === "free_agent_sign") {
    if (!isFreeAgent(career, playerId) && !registration.freeAgent) {
      return deny("Player is not a free agent.");
    }
    return allow();
  }

  if (intent === "permanent_buy") {
    if (registration.freeAgent) {
      return deny("Use free-agent signing for unattached players.");
    }
    if (loan) {
      return deny("Player is currently on loan and cannot be signed permanently.");
    }
    if (
      registration.owningClubId &&
      isSameManagerClub(registration.owningClubId, career.club)
    ) {
      return deny("You cannot buy players from your own club.");
    }
    const seller = opts?.fromClub ?? registration.playingClubId;
    if (!seller) return deny("Player is not registered at a club.");
    if (
      !opts?.listed &&
      getProtectedTransferPlayerIds(career, seller).has(playerId)
    ) {
      return deny("Club considers this player not for sale.");
    }
    return allow();
  }

  if (intent === "permanent_sell") {
    if (loan && isSameManagerClub(loan.loaneeClub, career.club)) {
      return deny("Cannot permanently sell a loaned-in player.");
    }
    if (loan && isSameManagerClub(loan.parentClub, career.club)) {
      return deny("Cannot sell a player who is away on loan. Recall them first.");
    }
    if (
      !registration.owningClubId ||
      !isSameManagerClub(registration.owningClubId, career.club)
    ) {
      return deny("Player is no longer at your club.");
    }
    return allow();
  }

  if (intent === "loan_in") {
    if (!canUserLoanInPlayers(career)) {
      return deny("Your club cannot take players on loan.");
    }
    if (loan) return deny("Player already has an active loan.");
    const fromClub = opts?.fromClub ?? registration.playingClubId;
    if (!fromClub) return deny("Player has no parent club.");
    if (!isValidLoanDirection(career, fromClub, career.club)) {
      return deny("Loans must come from a different Super League parent club.");
    }
    const listing =
      career.leagueListedPlayers.find((row) => row.playerId === playerId) ??
      null;
    if (listing) {
      if (!listingAllowsLoan(listing.listingType)) {
        return deny("Player is listed for permanent transfer only.");
      }
    } else if (getProtectedTransferPlayerIds(career, fromClub).has(playerId)) {
      return deny("Club will not loan this player.");
    }
    return allow();
  }

  if (intent === "loan_out") {
    if (!canUserLoanOutPlayers(career)) {
      return deny("Only Super League clubs can loan players out.");
    }
    if (loan) return deny("Player already has an active loan.");
    if (
      !registration.owningClubId ||
      !isSameManagerClub(registration.owningClubId, career.club)
    ) {
      return deny("Player is no longer at your club.");
    }
    if (registration.squadStatus === "RESERVES" || registration.squadStatus === "YOUTH") {
      return deny("Only first-team players can be loaned out.");
    }
    const toClub = opts?.toClub;
    if (toClub && !isValidLoanDirection(career, career.club, toClub)) {
      return deny("Loans must come from a Super League parent club.");
    }
    return allow();
  }

  if (intent === "list_permanent" || intent === "list_loan") {
    if (loan) {
      return deny(
        loan && isSameManagerClub(loan.loaneeClub, career.club)
          ? "Cannot list a loaned-in player."
          : "Cannot list a player who is away on loan."
      );
    }
    if (
      !registration.owningClubId ||
      !isSameManagerClub(registration.owningClubId, career.club)
    ) {
      return deny("Player is no longer at your club.");
    }
    if (intent === "list_loan" && !canUserLoanOutPlayers(career)) {
      return deny("Championship clubs cannot list players for loan.");
    }
    return allow();
  }

  if (intent === "reserve_to_champ") {
    if (registration.squadStatus !== "RESERVES") {
      return deny("Only reserve players can take Championship reserve bids.");
    }
    if (
      !registration.owningClubId ||
      !isSameManagerClub(registration.owningClubId, career.club)
    ) {
      return deny("Reserve is no longer at your club.");
    }
    return allow();
  }

  if (intent === "release_to_fa") {
    if (loan) {
      return deny(
        isSameManagerClub(loan.loaneeClub, career.club)
          ? "Cannot release a loaned-in player."
          : "Cannot release a player who is away on loan."
      );
    }
    return allow();
  }

  return deny("Unknown transfer intent.");
}

export function canBuyerOfferAgain(
  career: ManagerCareer,
  playerId: string,
  offerClub: string,
  asLoan: boolean
): boolean {
  if (hasPendingOfferFromClub(career, playerId, offerClub, asLoan)) {
    return false;
  }
  // Block simultaneous permanent + loan from same club.
  if (hasPendingOfferFromClub(career, playerId, offerClub, !asLoan)) {
    return false;
  }
  return true;
}

export function resolveListingForIntent(
  listingType: TransferListingType | null | undefined,
  intent: "permanent" | "loan"
): boolean {
  const resolved = resolveTransferListingType(listingType);
  return intent === "loan"
    ? listingAllowsLoan(resolved)
    : listingAllowsPermanent(resolved);
}
