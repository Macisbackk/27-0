import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { isSameManagerClub } from "../clubs/super-league-display";
import type {
  ActiveLoan,
  InboxMessage,
  LeagueTransferActivity,
  ManagerCareer,
  PlayerContract,
  SquadRole,
} from "./types";
import {
  formatWage,
  generateInitialContract,
} from "./managerContracts";
import { getManagerClubTeamRating } from "./managerRating";
import {
  findPlayerLeagueClub,
  getLeagueClubRosterIds,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { getManagerPlayer } from "./managerPlayers";
import { getPlayerSigningDemand } from "./managerTransfers";
import { createInitialPlayerState } from "./managerSquad";
import {
  addTransferIncome,
  canAffordAdditionalWage,
  deductTransferFee,
  getTransferBudget,
  syncManagerFinance,
} from "./managerFinance";
import { computeCareerWageBill } from "./managerReserveContracts";
import { pushInboxMessage, normalizeInboxMessage } from "./managerInbox";
import { pruneTransferWatchlist } from "./managerWatchlist";
import {
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  isUserInChampionship,
  resolveClubCompetitionForCareer,
} from "./leagueMembership";
import { getManagerModePlayerRating } from "./managerSquadRatings";

function listingAllowsLoanType(
  listingType?: "permanent" | "loan" | "both" | null
): boolean {
  const t = listingType ?? "permanent";
  return t === "loan" || t === "both";
}

/** Local copy of transfer-league protection to avoid import cycles. */
function isProtectedLoanTarget(
  career: ManagerCareer,
  club: string,
  playerId: string
): boolean {
  const roster = getLeagueClubRosterIds(career, club);
  let topRating = 0;
  const ratings: { id: string; rating: number }[] = [];
  for (const id of roster) {
    const player = getManagerPlayer(career, id) ?? getPlayerById(id);
    if (!player) continue;
    const rating = getManagerModePlayerRating(
      id,
      player.name,
      player.peakRating
    );
    ratings.push({ id, rating });
    if (rating > topRating) topRating = rating;
  }
  return new Set(
    ratings.filter((row) => row.rating >= topRating - 1).map((row) => row.id)
  ).has(playerId);
}

export interface LoanDealOpts {
  loanFee: number;
  parentWageShare?: number;
  wagePerYear?: number;
  yearsRequested?: number;
  squadRole?: SquadRole;
  canRecall?: boolean;
}

/**
 * Loans are one-way development deals:
 * Super League parents may develop players at Championship or other Super League clubs.
 *
 * Wage split negotiation (the share **your club** pays):
 * - 50%+ always accepted
 * - ~25% uncommon
 * - 0% rare
 */
export function isValidLoanDirection(
  career: ManagerCareer,
  parentClub: string,
  loaneeClub: string
): boolean {
  if (isSameManagerClub(parentClub, loaneeClub)) return false;
  const parentCompetition = resolveClubCompetitionForCareer(parentClub, career);
  const loaneeCompetition = resolveClubCompetitionForCareer(loaneeClub, career);
  return (
    parentCompetition === "super-league" &&
    (loaneeCompetition === "championship" || loaneeCompetition === "super-league")
  );
}

/** Super League managers can loan players out / list them for loan. */
export function canUserLoanOutPlayers(career: ManagerCareer): boolean {
  return !isUserInChampionship(career);
}

/** Both playable leagues can take eligible Super League players on loan. */
export function canUserLoanInPlayers(career: ManagerCareer): boolean {
  return Boolean(career.club);
}

/** SL parents can loan to Championship or another Super League club (never self). */
export function getLoanOutDestinationClubs(career: ManagerCareer): string[] {
  const championship = getCareerChampionshipClubs(career);
  const superLeague = getCareerSuperLeagueClubs(career);
  return [...new Set([...championship, ...superLeague])].filter(
    (club) => !isSameManagerClub(club, career.club)
  );
}

function clampWageShare(share: number): number {
  if (!Number.isFinite(share)) return 0.5;
  return Math.max(0, Math.min(1, share));
}

/** Round to nearest 5% for stable negotiation rolls. */
export function normalizeLoanWageSharePct(pct: number): number {
  if (!Number.isFinite(pct)) return 50;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return Math.round(clamped / 5) * 5;
}

/**
 * Chance the other club accepts a proposed wage share for **your** club.
 * Share is 0–1 (portion you pay). 50%+ always lands; ~25% is uncommon; 0% rare.
 */
export function loanWageShareAcceptanceChance(userWageShare: number): number {
  const s = clampWageShare(userWageShare);
  if (s >= 0.5) return 1;
  if (s >= 0.25) {
    // 25% → ~0.18, 50% → 1.0
    return 0.18 + ((s - 0.25) / 0.25) * 0.82;
  }
  // 0% → ~0.035, 25% → ~0.18
  return 0.035 + (s / 0.25) * 0.145;
}

export function evaluateLoanWageShareOffer(
  career: ManagerCareer,
  playerId: string,
  proposedUserWageShare: number
): { accepted: boolean; reason: string; userWageShare: number } {
  const userWageShare = clampWageShare(proposedUserWageShare);
  const pct = Math.round(userWageShare * 100);
  const chance = loanWageShareAcceptanceChance(userWageShare);

  if (chance >= 1) {
    return {
      accepted: true,
      reason: `${pct}% wage share agreed.`,
      userWageShare,
    };
  }

  // Deterministic per week/offer band so spam-clicking the same % does not re-roll.
  const band = normalizeLoanWageSharePct(pct);
  const rng = seedrandom(
    `${career.seed}-loan-split-v1-${career.seasonYear}-w${career.gameWeek}-${playerId}-${band}`
  );
  const accepted = rng() < chance;

  if (accepted) {
    return {
      accepted: true,
      reason:
        pct <= 5
          ? `Rare deal — only ${pct}% wage share agreed.`
          : pct <= 30
            ? `Uncommon deal — ${pct}% wage share agreed.`
            : `${pct}% wage share agreed.`,
      userWageShare,
    };
  }

  return {
    accepted: false,
    reason:
      pct <= 10
        ? "Club refused a near-free wage loan. Offer closer to 50%."
        : pct < 40
          ? `Need nearer ${pct}% wage share — try 50%.`
          : `Club rejected ${pct}% — meet them at 50% to guarantee the deal.`,
    userWageShare,
  };
}

export function getActiveLoan(
  career: ManagerCareer,
  playerId: string
): ActiveLoan | undefined {
  return (career.activeLoans ?? []).find((l) => l.playerId === playerId);
}

/** Parent still owns the player but they are away at another club. */
export function isPlayerAwayOnLoan(
  career: ManagerCareer,
  playerId: string
): boolean {
  const loan = getActiveLoan(career, playerId);
  if (!loan) return false;
  return (
    isSameManagerClub(loan.parentClub, career.club) &&
    !isSameManagerClub(loan.loaneeClub, career.club)
  );
}

/** Player is on loan at the user's club (not owned permanently). */
export function isPlayerLoanedIn(
  career: ManagerCareer,
  playerId: string
): boolean {
  const loan = getActiveLoan(career, playerId);
  if (!loan) return false;
  return (
    isSameManagerClub(loan.loaneeClub, career.club) &&
    !isSameManagerClub(loan.parentClub, career.club)
  );
}

/** Loans are wage-share deals — no upfront fee on the open market. */
export function suggestedLoanFee(
  _career: ManagerCareer,
  _playerId: string,
  _fromClub?: string,
  _listed = true
): number {
  return 0;
}

function recordLoanTransfer(
  career: ManagerCareer,
  loan: ActiveLoan,
  playerName: string
): LeagueTransferActivity {
  return {
    id: `loan-${loan.playerId}-${career.gameWeek}-${Date.now()}`,
    week: career.gameWeek,
    fromClub: loan.parentClub,
    toClub: loan.loaneeClub,
    playerId: loan.playerId,
    playerName,
    fee: loan.loanFee,
    sourceSquad: "senior",
    transferType: "loan",
  };
}

function createLoanInboxMessage(
  career: ManagerCareer,
  title: string,
  body: string,
  playerId: string,
  playerName: string
) {
  return normalizeInboxMessage(
    {
      id: `loan-${playerId}-w${career.gameWeek}-${Date.now()}`,
      type: "transfer_complete",
      title,
      body,
      read: false,
      resolved: false,
      playerId,
      playerName,
    },
    career
  );
}

/** Season-end loan return — unread until the popup is acknowledged. */
function createLoanEndedInboxMessage(
  career: ManagerCareer,
  body: string,
  playerId: string,
  playerName: string,
  direction: "incoming" | "outgoing"
) {
  return normalizeInboxMessage(
    {
      id: `loan-ended-${direction}-${playerId}-s${career.seasonYear}`,
      type: "loan_ended",
      title: "Loan Ended",
      body,
      read: false,
      resolved: false,
      playerId,
      playerName,
    },
    career
  );
}

export function isLoanEndedInboxMessage(message: {
  id: string;
  type: string;
  title?: string;
}): boolean {
  if (message.type === "loan_ended") return true;
  // Legacy season-end loan mail before dedicated type.
  return (
    message.type === "transfer_complete" &&
    message.title === "Loan Ended" &&
    message.id.startsWith("loan-")
  );
}

/** Unread loan-ended inbox item — surfaced as a popup on the hub. */
export function getPendingLoanEndedPopup(
  career: ManagerCareer
): InboxMessage | undefined {
  return career.inboxMessages.find(
    (m) => isLoanEndedInboxMessage(m) && !m.read && Boolean(m.playerId)
  );
}

export function acknowledgeLoanEndedPopup(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, read: true, resolved: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
}

function clearPlayerFromMatchday(
  career: ManagerCareer,
  playerId: string
): Pick<ManagerCareer, "matchdayXiii" | "matchdayInterchange"> {
  return {
    matchdayXiii: career.matchdayXiii.map((id) => (id === playerId ? "" : id)),
    matchdayInterchange: career.matchdayInterchange.map((id) =>
      id === playerId ? "" : id
    ),
  };
}

function withUpdatedWageBill(career: ManagerCareer): ManagerCareer {
  const wageBill = computeCareerWageBill(career);
  return syncManagerFinance({ ...career, wageBill });
}

/**
 * User loans IN a player from another club (temporary signing).
 */
export function completeIncomingLoan(
  career: ManagerCareer,
  playerId: string,
  fromClub: string,
  opts: LoanDealOpts
): ManagerCareer {
  if (!canUserLoanInPlayers(career)) return career;
  if (!isValidLoanDirection(career, fromClub, career.club)) return career;
  if (getActiveLoan(career, playerId)) return career;
  if (career.squad.some((p) => p.playerId === playerId)) return career;

  const sellerClub = findPlayerLeagueClub(career, playerId);
  if (!sellerClub || !isSameManagerClub(sellerClub, fromClub)) return career;
  if (isSameManagerClub(fromClub, career.club)) return career;

  const listing = career.leagueListedPlayers.find((row) => row.playerId === playerId);
  if (listing) {
    // Permanently listed-only players are not available on loan.
    if (!listingAllowsLoanType(listing.listingType)) return career;
  } else if (isProtectedLoanTarget(career, fromClub, playerId)) {
    // Unlisted loan approaches: block protected first-team core.
    return career;
  }

  const parentWageShare = clampWageShare(opts.parentWageShare ?? 0.5);
  const loaneeWageShare = 1 - parentWageShare;
  const demand = getPlayerSigningDemand(career, playerId);
  const wagePerYear = opts.wagePerYear ?? demand.wagePerYear;
  const loanFee = Math.max(0, Math.round(opts.loanFee));

  if (getTransferBudget(career) < loanFee) return career;
  if (!canAffordAdditionalWage(career, Math.round(wagePerYear * loaneeWageShare))) {
    return career;
  }
  if (career.squad.length >= 35) return career;

  const rep = getManagerClubTeamRating(career.club);
  const contract = generateInitialContract(playerId, false, rep, career);
  contract.wagePerYear = wagePerYear;
  contract.yearsRemaining = opts.yearsRequested ?? 1;
  contract.squadRole = opts.squadRole ?? demand.squadRole;
  contract.expiresAtSeasonEnd = true;
  contract.isLoanPlacement = true;
  contract.status = "on_loan";
  contract.renewalDemand = undefined;
  contract.purchaseFee = loanFee;

  const loan: ActiveLoan = {
    playerId,
    parentClub: fromClub,
    loaneeClub: career.club,
    endsAtSeasonYear: career.seasonYear,
    parentWageShare,
    canRecall: false,
    originalContract: { ...contract },
    loanFee,
  };

  const nextContracts = { ...career.contracts, [playerId]: contract };
  const nextListed = career.leagueListedPlayers.filter(
    (l) => l.playerId !== playerId
  );
  const sellerFunds = { ...career.clubFunds };
  sellerFunds[fromClub] = (sellerFunds[fromClub] ?? 0) + loanFee;

  let next: ManagerCareer = {
    ...career,
    clubFunds: sellerFunds,
    squad: [...career.squad, createInitialPlayerState(playerId)],
    contracts: nextContracts,
    leagueListedPlayers: nextListed,
    transferMarket: [
      ...new Set([
        ...nextListed.map((l) => l.playerId),
        ...career.transferMarket.filter(
          (id) => career.playerTransferStatus[id]?.listed
        ),
      ]),
    ],
    activeLoans: [...(career.activeLoans ?? []), loan],
    leagueTransfers: [
      recordLoanTransfer(career, loan, getPlayerById(playerId)?.name ?? "Player"),
      ...(career.leagueTransfers ?? []),
    ].slice(0, 48),
    updatedAt: new Date().toISOString(),
  };

  next = transferLeaguePlayer(next, playerId, fromClub, career.club);
  next = deductTransferFee(next, loanFee);
  next = withUpdatedWageBill(next);

  const playerName =
    getManagerPlayer(next, playerId)?.name ??
    getPlayerById(playerId)?.name ??
    "Player";
  return pruneTransferWatchlist(
    pushInboxMessage(
      next,
      createLoanInboxMessage(
        next,
        "Loan Completed",
        `${playerName} has joined on loan from ${fromClub} until the end of the season${
          loanFee > 0 ? `. Fee: ${formatWage(loanFee)}` : ""
        }. You pay ${Math.round(loaneeWageShare * 100)}% of wages (${formatWage(Math.round(wagePerYear * loaneeWageShare))}/yr).`,
        playerId,
        playerName
      )
    ),
    [playerId]
  );
}

/**
 * User loans OUT a squad player to another club.
 */
export function completeOutgoingLoan(
  career: ManagerCareer,
  playerId: string,
  toClub: string,
  opts: LoanDealOpts
): ManagerCareer {
  if (!canUserLoanOutPlayers(career)) return career;
  if (!isValidLoanDirection(career, career.club, toClub)) return career;
  if (getActiveLoan(career, playerId)) return career;
  if (!career.squad.some((p) => p.playerId === playerId)) return career;
  if (isSameManagerClub(toClub, career.club)) return career;

  const originalContract = career.contracts[playerId];
  if (!originalContract) return career;

  const parentWageShare = clampWageShare(opts.parentWageShare ?? 0.5);
  const loanFee = Math.max(0, Math.round(opts.loanFee));
  const buyerFunds = career.clubFunds[toClub] ?? 0;
  if (loanFee > 0 && buyerFunds < loanFee) return career;

  const loan: ActiveLoan = {
    playerId,
    parentClub: career.club,
    loaneeClub: toClub,
    endsAtSeasonYear: career.seasonYear,
    parentWageShare,
    canRecall: opts.canRecall ?? true,
    originalContract: { ...originalContract },
    loanFee,
  };

  const matchday = clearPlayerFromMatchday(career, playerId);
  const nextTransfer = { ...career.playerTransferStatus };
  delete nextTransfer[playerId];

  const clubFunds = { ...career.clubFunds };
  if (loanFee > 0) {
    clubFunds[toClub] = buyerFunds - loanFee;
  }

  let next: ManagerCareer = {
    ...career,
    ...matchday,
    clubFunds,
    squad: career.squad.filter((p) => p.playerId !== playerId),
    // Keep contract — parent still owns and pays parentWageShare
    playerTransferStatus: nextTransfer,
    activeLoans: [...(career.activeLoans ?? []), loan],
    leagueTransfers: [
      recordLoanTransfer(
        career,
        loan,
        getManagerPlayer(career, playerId)?.name ??
          getPlayerById(playerId)?.name ??
          "Player"
      ),
      ...(career.leagueTransfers ?? []),
    ].slice(0, 48),
    updatedAt: new Date().toISOString(),
  };

  next = transferLeaguePlayer(next, playerId, career.club, toClub);
  if (loanFee > 0) {
    next = addTransferIncome(next, loanFee);
  }
  next = withUpdatedWageBill(next);

  const playerName =
    getPlayerById(playerId)?.name ??
    getManagerPlayer(career, playerId)?.name ??
    "Player";
  return pushInboxMessage(
    next,
    createLoanInboxMessage(
      next,
      "Loan Out Completed",
      `${playerName} has joined ${toClub} on loan until the end of the season${
        loanFee > 0 ? `. Fee received: ${formatWage(loanFee)}` : ""
      }. You still pay ${Math.round(parentWageShare * 100)}% of wages.`,
      playerId,
      playerName
    )
  );
}

function restoreOutgoingLoanPlayer(
  career: ManagerCareer,
  loan: ActiveLoan
): ManagerCareer {
  const contract: PlayerContract = {
    ...loan.originalContract,
  };
  const nextContracts = { ...career.contracts, [loan.playerId]: contract };
  const alreadyInSquad = career.squad.some((p) => p.playerId === loan.playerId);

  let next: ManagerCareer = {
    ...career,
    contracts: nextContracts,
    squad: alreadyInSquad
      ? career.squad
      : [...career.squad, createInitialPlayerState(loan.playerId)],
    activeLoans: (career.activeLoans ?? []).filter(
      (l) => l.playerId !== loan.playerId
    ),
    updatedAt: new Date().toISOString(),
  };

  next = transferLeaguePlayer(next, loan.playerId, loan.loaneeClub, career.club);
  return withUpdatedWageBill(next);
}

function returnIncomingLoanPlayer(
  career: ManagerCareer,
  loan: ActiveLoan
): ManagerCareer {
  const nextContracts = { ...career.contracts };
  delete nextContracts[loan.playerId];
  const matchday = clearPlayerFromMatchday(career, loan.playerId);

  let next: ManagerCareer = {
    ...career,
    ...matchday,
    squad: career.squad.filter((p) => p.playerId !== loan.playerId),
    contracts: nextContracts,
    activeLoans: (career.activeLoans ?? []).filter(
      (l) => l.playerId !== loan.playerId
    ),
    updatedAt: new Date().toISOString(),
  };

  next = transferLeaguePlayer(
    next,
    loan.playerId,
    career.club,
    loan.parentClub
  );
  return withUpdatedWageBill(next);
}

/** Recall an outgoing loan early (user must be parent and canRecall). */
export function recallLoan(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const loan = getActiveLoan(career, playerId);
  if (!loan) return career;
  if (!isSameManagerClub(loan.parentClub, career.club)) return career;
  if (!loan.canRecall) return career;
  if (isSameManagerClub(loan.loaneeClub, career.club)) return career;

  let next = restoreOutgoingLoanPlayer(career, loan);
  const playerName = getPlayerById(playerId)?.name ?? "Player";
  return pushInboxMessage(
    next,
    createLoanInboxMessage(
      next,
      "Loan Recalled",
      `${playerName} has been recalled from ${loan.loaneeClub} and is available for selection again.`,
      playerId,
      playerName
    )
  );
}

/**
 * At season advance: return all loans ending this season.
 * Call while career.seasonYear is still the finishing season.
 */
export function returnExpiredLoans(career: ManagerCareer): ManagerCareer {
  const loans = career.activeLoans ?? [];
  if (loans.length === 0) return career;

  let next = career;
  const expired = loans.filter((l) => l.endsAtSeasonYear <= career.seasonYear);
  if (expired.length === 0) return career;

  for (const loan of expired) {
    const still = getActiveLoan(next, loan.playerId);
    if (!still) continue;

    const playerName = getPlayerById(loan.playerId)?.name ?? "Player";
    if (isSameManagerClub(still.parentClub, next.club)) {
      next = restoreOutgoingLoanPlayer(next, still);
      next = pushInboxMessage(
        next,
        createLoanEndedInboxMessage(
          next,
          `${playerName} has returned from loan at ${still.loaneeClub}.`,
          loan.playerId,
          playerName,
          "outgoing"
        )
      );
    } else if (isSameManagerClub(still.loaneeClub, next.club)) {
      next = returnIncomingLoanPlayer(next, still);
      next = pushInboxMessage(
        next,
        createLoanEndedInboxMessage(
          next,
          `${playerName} has returned to ${still.parentClub} after their loan.`,
          loan.playerId,
          playerName,
          "incoming"
        )
      );
    } else {
      // Stale loan row: if the player is still on our squad, treat as ending
      // an incoming loan so a "renewed" loanee cannot become permanent.
      const onSquad = next.squad.some((p) => p.playerId === loan.playerId);
      if (onSquad) {
        const repaired: ActiveLoan = {
          ...still,
          loaneeClub: next.club,
        };
        next = returnIncomingLoanPlayer(next, repaired);
        next = pushInboxMessage(
          next,
          createLoanEndedInboxMessage(
            next,
            `${playerName} has returned to ${still.parentClub} after their loan.`,
            loan.playerId,
            playerName,
            "incoming"
          )
        );
      } else {
        next = {
          ...next,
          activeLoans: (next.activeLoans ?? []).filter(
            (l) => l.playerId !== loan.playerId
          ),
        };
      }
    }
  }

  return next;
}
