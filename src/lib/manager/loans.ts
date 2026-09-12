/**
 * Loan system: agreements, duration tracking, wage sharing, recall, and returns.
 * Pure simulation logic.
 */

import type {
  ActiveLoan,
  ManagerState,
  PlayerLoanInfo,
} from "./types";

export interface LoanOperationResult {
  success: boolean;
  state: ManagerState;
  error?: string;
  loan?: ActiveLoan;
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
    inbox: {
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
    },
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
    },
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

  return nextState;
}
