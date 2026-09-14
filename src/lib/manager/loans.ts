/**
 * Loan system: agreements, duration tracking, wage sharing, recall, and returns.
 * Pure simulation logic.
 */

import type {
  ActiveLoan,
  ManagerState,
  PlayerLoanInfo,
  ManagerPlayer,
} from "./types";
import { calculateSalaryCapUsage } from "./contracts";

export interface LoanOperationResult {
  success: boolean;
  state: ManagerState;
  error?: string;
  loan?: ActiveLoan;
}

/** Toggle loan-list flag so destination clubs can take the player on loan more easily. */
export function setPlayerLoanListed(
  state: ManagerState,
  playerId: string,
  isListed: boolean
): LoanOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) {
    return { success: false, state, error: "Free agents cannot be loan listed." };
  }
  if (player.loan) {
    return { success: false, state, error: "Player is already out on loan." };
  }

  return {
    success: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...player, isLoanListed: isListed },
      },
    },
  };
}

/**
 * Creates an authoritative loan agreement between parent and destination club.
 */
export function createLoanAgreement(
  state: ManagerState,
  parentClubId: string,
  destinationClubId: string,
  playerId: string,
  totalWeeks: number,
  wageContributionPct = 50,
  canRecall = true
): LoanOperationResult {
  if (parentClubId === destinationClubId) {
    return { success: false, state, error: "Cannot loan player to the same club." };
  }

  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (player.clubId !== parentClubId) {
    return { success: false, state, error: "Player does not belong to the parent club." };
  }
  if (player.loan !== null) {
    return { success: false, state, error: "Player is already out on loan." };
  }

  const parentClub = state.clubs[parentClubId];
  const destClub = state.clubs[destinationClubId];
  if (!parentClub || !destClub) return { success: false, state, error: "Invalid clubs involved in loan." };

  if (parentClub.competitionId === "championship" && destClub.competitionId === "super-league") {
    return {
      success: false,
      state,
      error: "Unrealistic loan: Championship clubs cannot loan players to Super League clubs.",
    };
  }

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  const loanInfo: PlayerLoanInfo = {
    parentClubId,
    destinationClubId,
    weeksRemaining: totalWeeks,
    wageContributionPct,
    canRecall,
  };

  const activeLoan: ActiveLoan = {
    id: `loan_${playerId}_${Date.now()}`,
    playerId,
    playerName: player.name,
    parentClubId,
    destinationClubId,
    seasonStarted: currentSeason,
    weekStarted: currentWeek,
    totalWeeks,
    weeksRemaining: totalWeeks,
    wageContributionPct,
    canRecall,
  };

  // Remove player from parent club lineup if present
  const parentStarting13 = parentClub.lineup.starting13.map(id => id === playerId ? null : id);
  const parentBench = parentClub.lineup.bench.map(id => id === playerId ? null : id);

  const updatedParentClub = {
    ...parentClub,
    lineup: { starting13: parentStarting13, bench: parentBench },
  };

  const updatedPlayer = {
    ...player,
    loan: loanInfo,
  };

  const userClubId = state.manager.clubId;
  const involvesUser =
    parentClubId === userClubId || destinationClubId === userClubId;

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    clubs: {
      ...state.clubs,
      [parentClubId]: updatedParentClub,
    },
    transfers: {
      ...state.transfers,
      activeLoans: [activeLoan, ...state.transfers.activeLoans],
    },
    inbox: involvesUser
      ? {
          ...state.inbox,
          messages: [
            {
              id: `inbox_loan_start_${playerId}_${Date.now()}`,
              season: currentSeason,
              week: currentWeek,
              dateStr: `Week ${currentWeek}`,
              sender: "Loan Coordinator",
              subject: `Loan Completed: ${player.name} to ${destClub.name}`,
              body: `${player.name} has joined ${destClub.name} on a ${totalWeeks}-week loan from ${parentClub.name}. (${wageContributionPct}% wage contribution).`,
              category: "loan",
              isRead: false,
            },
            ...state.inbox.messages,
          ],
          unreadCount: state.inbox.unreadCount + 1,
        }
      : state.inbox,
  };

  return { success: true, state: nextState, loan: activeLoan };
}

/**
 * Recalls an active loan back to the parent club.
 */
export function recallLoan(
  state: ManagerState,
  playerId: string
): LoanOperationResult {
  const player = state.players[playerId];
  if (!player || !player.loan) {
    return { success: false, state, error: "Player is not currently on loan." };
  }

  if (!player.loan.canRecall) {
    return { success: false, state, error: "This loan agreement does not permit early recall." };
  }

  const { parentClubId, destinationClubId } = player.loan;
  const parentClub = state.clubs[parentClubId];
  const destClub = state.clubs[destinationClubId];

  // Remove from destination club lineup if present
  let updatedDestClub = destClub;
  if (destClub) {
    const destStarting13 = destClub.lineup.starting13.map(id => id === playerId ? null : id);
    const destBench = destClub.lineup.bench.map(id => id === playerId ? null : id);
    updatedDestClub = {
      ...destClub,
      lineup: { starting13: destStarting13, bench: destBench },
    };
  }

  const updatedPlayer = {
    ...player,
    loan: null,
  };

  const updatedActiveLoans = state.transfers.activeLoans.filter((l) => l.playerId !== playerId);

  const nextClubs = updatedDestClub ? {
    ...state.clubs,
    [destinationClubId]: updatedDestClub,
  } : state.clubs;

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;
  const userClubId = state.manager.clubId;
  const involvesUser =
    parentClubId === userClubId || destinationClubId === userClubId;

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    clubs: nextClubs,
    transfers: {
      ...state.transfers,
      activeLoans: updatedActiveLoans,
    },
    inbox: involvesUser
      ? {
          ...state.inbox,
          messages: [
            {
              id: `inbox_loan_recalled_${playerId}_${Date.now()}`,
              season: currentSeason,
              week: currentWeek,
              dateStr: `Week ${currentWeek}`,
              sender: "Loan Coordinator",
              subject: `Loan Recalled: ${player.name}`,
              body: `${player.name} has been recalled from ${destClub?.name || "loan"} and has returned to ${parentClub?.name || "parent squad"}.`,
              category: "loan",
              isRead: false,
            },
            ...state.inbox.messages,
          ],
          unreadCount: state.inbox.unreadCount + 1,
        }
      : state.inbox,
  };

  return { success: true, state: nextState };
}

/**
 * Weekly tick for all active loans: decrements weeks remaining,
 * automatically returns players whose loan has expired.
 */
export function tickActiveLoans(state: ManagerState): ManagerState {
  let nextState = state;
  const expiredPlayerIds: string[] = [];

  for (const loan of state.transfers.activeLoans) {
    const player = state.players[loan.playerId];
    if (!player || !player.loan) continue;

    const remaining = player.loan.weeksRemaining - 1;
    if (remaining <= 0) {
      expiredPlayerIds.push(player.id);
    } else {
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [player.id]: {
            ...player,
            loan: {
              ...player.loan,
              weeksRemaining: remaining,
            },
          },
        },
        transfers: {
          ...nextState.transfers,
          activeLoans: nextState.transfers.activeLoans.map((l) =>
            l.playerId === player.id ? { ...l, weeksRemaining: remaining } : l
          ),
        },
      };
    }
  }

  // Handle expired loans
  for (const pid of expiredPlayerIds) {
    const p = nextState.players[pid];
    if (!p || !p.loan) continue;
    const destClub = nextState.clubs[p.loan.destinationClubId];
    const parentClub = nextState.clubs[p.loan.parentClubId];
    const parentClubId = p.loan.parentClubId;
    const destinationClubId = p.loan.destinationClubId;

    // Clean destination lineup
    let clubsUpdate = nextState.clubs;
    if (destClub) {
      const destStarting13 = destClub.lineup.starting13.map(id => id === pid ? null : id);
      const destBench = destClub.lineup.bench.map(id => id === pid ? null : id);
      clubsUpdate = {
        ...clubsUpdate,
        [destClub.id]: {
          ...destClub,
          lineup: { starting13: destStarting13, bench: destBench },
        },
      };
    }

    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [pid]: {
          ...p,
          loan: null,
        },
      },
      clubs: clubsUpdate,
      transfers: {
        ...nextState.transfers,
        activeLoans: nextState.transfers.activeLoans.filter((l) => l.playerId !== pid),
      },
    };

    const userClubId = nextState.manager.clubId;
    const involvesUser =
      parentClubId === userClubId || destinationClubId === userClubId;
    if (involvesUser) {
      nextState = {
        ...nextState,
        inbox: {
          ...nextState.inbox,
          messages: [
            {
              id: `inbox_loan_expired_${pid}_${Date.now()}`,
              season: nextState.calendar.currentSeason,
              week: nextState.calendar.currentWeek,
              dateStr: `Week ${nextState.calendar.currentWeek}`,
              sender: "Loan Coordinator",
              subject: `Loan Expired: ${p.name}`,
              body: `${p.name}'s loan spell at ${destClub?.name || "destination club"} has concluded. The player has returned to ${parentClub?.name || "parent squad"}.`,
              category: "loan",
              isRead: false,
            },
            ...nextState.inbox.messages,
          ],
          unreadCount: nextState.inbox.unreadCount + 1,
        },
      };
    }
  }

  return nextState;
}

/**
 * Checks if a player from another club is eligible to be loaned in.
 */
export function isPlayerEligibleForLoanIn(
  player: ManagerPlayer,
  parentClub: { competitionId: string },
  destinationClub: { competitionId: string }
): { eligible: boolean; reason?: string } {
  if (player.loan !== null) {
    return { eligible: false, reason: "Already out on loan." };
  }
  if (player.isRetired) {
    return { eligible: false, reason: "Player has retired." };
  }
  if (player.injury) {
    return { eligible: false, reason: "Player is injured." };
  }
  if (player.suspension) {
    return { eligible: false, reason: "Player is suspended." };
  }

  // Realistic constraint: Super League teams cannot loan in from Championship
  if (destinationClub.competitionId === "super-league" && parentClub.competitionId === "championship") {
    return {
      eligible: false,
      reason: "Super League clubs do not loan players in from Championship clubs.",
    };
  }

  // Key first-team regulars (80+ OVR in first team) are not available for loan
  if (player.squadTier === "first" && player.rating >= 80 && !player.isLoanListed) {
    return {
      eligible: false,
      reason: "Player is an indispensable first-team regular.",
    };
  }

  return { eligible: true };
}

/**
 * Loans a player IN to a destination club from a parent club.
 * Validates salary cap, realistic league flows, and parent club loan willingness.
 */
export function loanPlayerIn(
  state: ManagerState,
  destinationClubId: string,
  playerId: string,
  totalWeeks: number,
  wageContributionPct = 50,
  canRecall = true
): LoanOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) return { success: false, state, error: "Player is a free agent." };
  if (player.clubId === destinationClubId) {
    return { success: false, state, error: "Player already belongs to this club." };
  }

  const parentClub = state.clubs[player.clubId];
  const destClub = state.clubs[destinationClubId];
  if (!parentClub || !destClub) {
    return { success: false, state, error: "Invalid clubs involved in loan." };
  }

  // Eligibility check
  const eligibility = isPlayerEligibleForLoanIn(player, parentClub, destClub);
  if (!eligibility.eligible) {
    return {
      success: false,
      state,
      error: eligibility.reason || "Player is not available for loan.",
    };
  }

  // Wage contribution check
  if (wageContributionPct < 50 && player.age > 22 && !player.isLoanListed) {
    return {
      success: false,
      state,
      error: `${parentClub.name} requires at least a 50% wage contribution to loan out ${player.name}.`,
    };
  }

  // Salary cap headroom validation for destination club
  const weeklyCost = Math.round(((player.contract?.wageWeekly || 0) * wageContributionPct) / 100);
  const currentCap = calculateSalaryCapUsage(state, destinationClubId);
  if (weeklyCost > 0 && currentCap.availableCapWeekly < weeklyCost) {
    return {
      success: false,
      state,
      error: `Salary Cap Breach: Loaning ${player.name} requires £${weeklyCost.toLocaleString()}/wk cap room, but ${destClub.name} only has £${Math.max(0, currentCap.availableCapWeekly).toLocaleString()}/wk available.`,
    };
  }

  // Create authoritative loan agreement
  const agreement = createLoanAgreement(
    state,
    parentClub.id,
    destinationClubId,
    playerId,
    totalWeeks,
    wageContributionPct,
    canRecall
  );

  if (!agreement.success) {
    return agreement;
  }

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  const nextState: ManagerState = {
    ...agreement.state,
    inbox: {
      ...agreement.state.inbox,
      messages: [
        {
          id: `inbox_loan_in_${playerId}_${Date.now()}`,
          season: currentSeason,
          week: currentWeek,
          dateStr: `Week ${currentWeek}`,
          sender: `${parentClub.name} Chief Executive`,
          subject: `Loan Signing Confirmed: ${player.name}`,
          body: `${player.name} has arrived at ${destClub.name} on a ${totalWeeks}-week loan from ${parentClub.name} (${wageContributionPct}% wage share, £${weeklyCost.toLocaleString()}/wk). The player is immediately available for squad selection in Tactics.`,
          category: "loan",
          isRead: false,
        },
        ...agreement.state.inbox.messages,
      ],
      unreadCount: agreement.state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState, loan: agreement.loan };
}

/**
 * Terminates an incoming loan early from the destination club side.
 * Returns the player back to their parent club.
 */
export function terminateIncomingLoan(
  state: ManagerState,
  playerId: string,
  destinationClubId: string
): LoanOperationResult {
  const player = state.players[playerId];
  if (!player || !player.loan) {
    return { success: false, state, error: "Player is not currently on loan." };
  }
  if (player.loan.destinationClubId !== destinationClubId) {
    return { success: false, state, error: "Player is not on loan to this club." };
  }

  const { parentClubId } = player.loan;
  const parentClub = state.clubs[parentClubId];
  const destClub = state.clubs[destinationClubId];

  // Remove from destination club lineup
  let updatedDestClub = destClub;
  if (destClub) {
    const destStarting13 = destClub.lineup.starting13.map((id) => (id === playerId ? null : id));
    const destBench = destClub.lineup.bench.map((id) => (id === playerId ? null : id));
    updatedDestClub = {
      ...destClub,
      lineup: { starting13: destStarting13, bench: destBench },
    };
  }

  const updatedPlayer: ManagerPlayer = {
    ...player,
    loan: null,
  };

  const updatedActiveLoans = state.transfers.activeLoans.filter((l) => l.playerId !== playerId);

  const nextClubs = updatedDestClub
    ? {
        ...state.clubs,
        [destinationClubId]: updatedDestClub,
      }
    : state.clubs;

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    clubs: nextClubs,
    transfers: {
      ...state.transfers,
      activeLoans: updatedActiveLoans,
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `inbox_loan_terminated_${playerId}_${Date.now()}`,
          season: currentSeason,
          week: currentWeek,
          dateStr: `Week ${currentWeek}`,
          sender: "Loan Coordinator",
          subject: `Loan Terminated: ${player.name}`,
          body: `${player.name} has concluded their loan spell at ${destClub?.name || "destination club"} early and returned to ${parentClub?.name || "parent squad"}.`,
          category: "loan",
          isRead: false,
        },
        ...state.inbox.messages,
      ],
      unreadCount: state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState };
}

export type ExpiringLoanAlert = {
  key: string;
  playerId: string;
  playerName: string;
  direction: "in" | "out";
  otherClubId: string;
  weeksRemaining: number;
  canRecall: boolean;
};

function loanAlertKey(playerId: string, parentClubId: string, destinationClubId: string): string {
  return `${playerId}:${parentClubId}:${destinationClubId}`;
}

/**
 * Active loans involving the user club with weeksRemaining <= 2.
 */
export function getExpiringLoansForClub(
  state: ManagerState,
  clubId: string,
  weeksThreshold = 2
): ExpiringLoanAlert[] {
  const alerts: ExpiringLoanAlert[] = [];
  for (const loan of state.transfers.activeLoans || []) {
    if (loan.weeksRemaining > weeksThreshold) continue;
    const involves =
      loan.parentClubId === clubId || loan.destinationClubId === clubId;
    if (!involves) continue;
    const player = state.players[loan.playerId];
    const direction: "in" | "out" =
      loan.destinationClubId === clubId ? "in" : "out";
    const otherClubId =
      direction === "in" ? loan.parentClubId : loan.destinationClubId;
    alerts.push({
      key: loanAlertKey(loan.playerId, loan.parentClubId, loan.destinationClubId),
      playerId: loan.playerId,
      playerName: player?.name || loan.playerName,
      direction,
      otherClubId,
      weeksRemaining: loan.weeksRemaining,
      canRecall: loan.canRecall,
    });
  }
  alerts.sort(
    (a, b) =>
      a.weeksRemaining - b.weeksRemaining || a.playerName.localeCompare(b.playerName)
  );
  return alerts;
}

export function getUnacknowledgedLoanExpiryWarnings(
  state: ManagerState,
  clubId: string
): ExpiringLoanAlert[] {
  const alerts = getExpiringLoansForClub(state, clubId);
  const ack = state.settings?.loanExpiryAcknowledged;
  if (!ack || ack.season !== state.calendar.currentSeason) {
    return alerts;
  }
  const seen = new Set(ack.loanKeys);
  return alerts.filter((a) => !seen.has(a.key));
}

export function acknowledgeLoanExpiryWarnings(
  state: ManagerState,
  loanKeys: string[]
): ManagerState {
  const season = state.calendar.currentSeason;
  const prev = state.settings?.loanExpiryAcknowledged;
  const existing = prev && prev.season === season ? prev.loanKeys : [];
  const merged = Array.from(new Set([...existing, ...loanKeys]));

  return {
    ...state,
    settings: {
      ...state.settings,
      loanExpiryAcknowledged: {
        season,
        loanKeys: merged,
      },
    },
  };
}
