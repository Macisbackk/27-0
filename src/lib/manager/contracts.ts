/**
 * Contract management, renewals, terminations, free agency signings, and salary cap enforcement.
 * Pure simulation logic.
 */

import { SALARY_CAP, calculateMarketWage } from "./rules";
import type {
  ManagerState,
  PlayerContract,
  SquadRole,
} from "./types";

export interface ContractEvaluationResult {
  accepted: boolean;
  reason: string;
  minimumAcceptableWage: number;
}

export interface ContractOperationResult {
  success: boolean;
  state: ManagerState;
  error?: string;
}

/**
 * Calculates a club's active salary cap commitments and headroom.
 * Factors in marquee player exemptions and homegrown youth discounts.
 */
export function calculateSalaryCapUsage(state: ManagerState, clubId: string): {
  totalWageBillWeekly: number;
  capChargeWeekly: number;
  capLimitWeekly: number;
  availableCapWeekly: number;
  isOverCap: boolean;
  marqueePlayerIds: string[];
} {
  const club = state.clubs[clubId];
  if (!club) {
    return {
      totalWageBillWeekly: 0,
      capChargeWeekly: 0,
      capLimitWeekly: 0,
      availableCapWeekly: 0,
      isOverCap: false,
      marqueePlayerIds: [],
    };
  }

  const compId = club.competitionId;
  const rules = SALARY_CAP[compId] || SALARY_CAP["super-league"];
  const capLimitWeekly = rules.weeklyCap;

  // Gather all players under contract with this club
  const clubPlayers = Object.values(state.players).filter(
    (p) => p.clubId === clubId && p.contract && !p.isRetired
  );

  let totalWageBillWeekly = 0;
  // Sort players by wage descending to identify marquee candidates
  const sortedByWage = [...clubPlayers].sort(
    (a, b) => (b.contract?.wageWeekly || 0) - (a.contract?.wageWeekly || 0)
  );

  const marqueePlayerIds: string[] = [];
  let capChargeWeekly = 0;

  sortedByWage.forEach((p) => {
    const wage = p.contract?.wageWeekly || 0;
    totalWageBillWeekly += wage;

    // Check marquee exemption eligibility
    if (marqueePlayerIds.length < rules.maxMarqueePlayers && wage > rules.marqueeWeeklyCapCharge) {
      marqueePlayerIds.push(p.id);
      capChargeWeekly += rules.marqueeWeeklyCapCharge;
    } else if (p.squadTier === "academy" && p.age <= 21) {
      // Homegrown youth discount
      capChargeWeekly += Math.round(wage * rules.homegrownDiscountPct);
    } else {
      capChargeWeekly += wage;
    }
  });

  const availableCapWeekly = capLimitWeekly - capChargeWeekly;

  return {
    totalWageBillWeekly,
    capChargeWeekly,
    capLimitWeekly,
    availableCapWeekly,
    isOverCap: capChargeWeekly > capLimitWeekly,
    marqueePlayerIds,
  };
}

/**
 * Evaluates whether a player accepts a contract offer.
 */
export function evaluateContractOffer(
  player: { rating: number; age: number; morale: number; form: number },
  club: { reputation: number; competitionId: string },
  offeredWage: number,
  offeredRole: SquadRole
): ContractEvaluationResult {
  const marketWage = calculateMarketWage(player.rating, player.age, club.competitionId as any);

  // Minimum acceptable wage varies with role expectation and club reputation
  let roleMultiplier = 1.0;
  if (offeredRole === "star") roleMultiplier = 1.15;
  if (offeredRole === "rotation") roleMultiplier = 0.9;
  if (offeredRole === "youth" || offeredRole === "backup") roleMultiplier = 0.8;

  // Morale effect: low morale demands higher wage to stay
  const moraleDiscount = player.morale >= 80 ? 0.95 : (player.morale < 60 ? 1.15 : 1.0);

  const minimumAcceptable = Math.round(marketWage * roleMultiplier * moraleDiscount);

  if (offeredWage >= minimumAcceptable) {
    return {
      accepted: true,
      reason: "The player is satisfied with the financial terms and offered squad role.",
      minimumAcceptableWage: minimumAcceptable,
    };
  }

  const shortfall = minimumAcceptable - offeredWage;
  return {
    accepted: false,
    reason: `The offered wage (£${offeredWage.toLocaleString()}/wk) is below the player's expectation. Minimum acceptable is £${minimumAcceptable.toLocaleString()}/wk.`,
    minimumAcceptableWage: minimumAcceptable,
  };
}

/**
 * Renews an existing player's contract with salary cap validation.
 */
export function renewPlayerContract(
  state: ManagerState,
  playerId: string,
  offeredWage: number,
  contractYears: number,
  offeredRole: SquadRole
): ContractOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) return { success: false, state, error: "Player is a free agent." };

  const club = state.clubs[player.clubId];
  if (!club) return { success: false, state, error: "Club not found." };

  // 1. Evaluate player acceptance
  const evaluation = evaluateContractOffer(player, club, offeredWage, offeredRole);
  if (!evaluation.accepted) {
    return { success: false, state, error: evaluation.reason };
  }

  // 2. Test salary cap impact
  const currentWage = player.contract?.wageWeekly || 0;
  const wageDelta = offeredWage - currentWage;
  const currentCap = calculateSalaryCapUsage(state, club.id);

  if (wageDelta > 0 && currentCap.availableCapWeekly < wageDelta) {
    return {
      success: false,
      state,
      error: `Salary Cap Breach: This renewal increases weekly wages by £${wageDelta.toLocaleString()}/wk, but the club only has £${Math.max(0, currentCap.availableCapWeekly).toLocaleString()}/wk cap room.`,
    };
  }

  const currentSeason = state.calendar.currentSeason;
  const expiresSeason = currentSeason + contractYears;

  const updatedContract: PlayerContract = {
    wageWeekly: offeredWage,
    expiresSeason,
    role: offeredRole,
  };

  const updatedPlayer = {
    ...player,
    contract: updatedContract,
    morale: Math.min(100, player.morale + 10), // Renewal boosts morale
  };

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `contract_renewed_${playerId}_${Date.now()}`,
          season: currentSeason,
          week: state.calendar.currentWeek,
          dateStr: `Season ${currentSeason}`,
          sender: "Club Secretary",
          subject: `Contract Extension: ${player.name}`,
          body: `${player.name} has signed a ${contractYears}-year contract extension at £${offeredWage.toLocaleString()}/wk until the end of ${expiresSeason}.`,
          category: "contract",
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
 * Releases a player to Free Agency (mutual termination).
 * Deducts 4 weeks of wages as severance from club finances.
 */
export function releasePlayerContract(
  state: ManagerState,
  playerId: string
): ContractOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) return { success: false, state, error: "Player is already a free agent." };

  const club = state.clubs[player.clubId];
  if (!club) return { success: false, state, error: "Club not found." };

  const severance = (player.contract?.wageWeekly || 500) * 4;

  const updatedPlayer = {
    ...player,
    clubId: null,
    squadTier: null,
    contract: null,
    loan: null,
    form: 6.5,
    morale: 60,
  };

  // Clean lineup slots if player was in lineup
  const starting13 = club.lineup.starting13.map(id => id === playerId ? null : id);
  const bench = club.lineup.bench.map(id => id === playerId ? null : id);

  const updatedClub = {
    ...club,
    lineup: { starting13, bench },
    finances: {
      ...club.finances,
      balance: club.finances.balance - severance,
      seasonExpenses: club.finances.seasonExpenses + severance,
      history: [
        {
          id: `severance_${playerId}_${Date.now()}`,
          season: state.calendar.currentSeason,
          week: state.calendar.currentWeek,
          amount: -severance,
          category: "wages" as const,
          description: `Severance payout for release of ${player.name}`,
        },
        ...club.finances.history,
      ],
    },
  };

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    clubs: {
      ...state.clubs,
      [club.id]: updatedClub,
    },
  };

  return { success: true, state: nextState };
}

/**
 * Signs an unattached Free Agent to a club.
 */
export function signFreeAgent(
  state: ManagerState,
  clubId: string,
  playerId: string,
  offeredWage: number,
  contractYears: number,
  offeredRole: SquadRole
): ContractOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (player.clubId !== null) return { success: false, state, error: "Player is currently under contract with another club." };

  const club = state.clubs[clubId];
  if (!club) return { success: false, state, error: "Club not found." };

  // 1. Evaluate player acceptance
  const evaluation = evaluateContractOffer(player, club, offeredWage, offeredRole);
  if (!evaluation.accepted) {
    return { success: false, state, error: evaluation.reason };
  }

  // 2. Check salary cap
  const currentCap = calculateSalaryCapUsage(state, clubId);
  if (currentCap.availableCapWeekly < offeredWage) {
    return {
      success: false,
      state,
      error: `Salary Cap Breach: Signing ${player.name} requires £${offeredWage.toLocaleString()}/wk, but the club only has £${Math.max(0, currentCap.availableCapWeekly).toLocaleString()}/wk room under the cap.`,
    };
  }

  const currentSeason = state.calendar.currentSeason;
  const expiresSeason = currentSeason + contractYears;

  const updatedPlayer = {
    ...player,
    clubId,
    squadTier: "first" as const,
    contract: {
      wageWeekly: offeredWage,
      expiresSeason,
      role: offeredRole,
    },
    morale: 85,
    form: 7.0,
  };

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    transfers: {
      ...state.transfers,
      completedTransfers: [
        {
          id: `transfer_fa_${playerId}_${Date.now()}`,
          season: currentSeason,
          week: state.calendar.currentWeek,
          playerId,
          playerName: player.name,
          fromClubId: null,
          toClubId: clubId,
          fee: 0,
          wageWeekly: offeredWage,
          contractYears,
        },
        ...state.transfers.completedTransfers,
      ],
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `fa_signed_${playerId}_${Date.now()}`,
          season: currentSeason,
          week: state.calendar.currentWeek,
          dateStr: `Season ${currentSeason}`,
          sender: "Recruitment Department",
          subject: `Free Agent Signed: ${player.name}`,
          body: `${player.name} has signed for ${club.name} as a free agent on a ${contractYears}-year contract (£${offeredWage.toLocaleString()}/wk).`,
          category: "transfer",
          isRead: false,
        },
        ...state.inbox.messages,
      ],
      unreadCount: state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState };
}
