/**
 * Contract management, renewals, terminations, free agency signings, and salary cap enforcement.
 * Pure simulation logic.
 */

import {
  SALARY_CAP,
  calculateMarketWage,
  CALENDAR_RULES,
  CONTRACT_NEGOTIATION,
} from "./rules";
import type {
  ManagerState,
  ManagerPlayer,
  PlayerContract,
  SquadRole,
} from "./types";

export type ContractOfferContext = "renewal" | "transfer" | "free_agent";

export interface ContractEvaluationResult {
  accepted: boolean;
  reason: string;
  /** Soft floor — offers at or above this are accepted. */
  minimumAcceptableWage: number;
  /** Agent's preferred / asking wage (UI guidance). */
  askingWage: number;
}

export interface EvaluateContractOfferOptions {
  context?: ContractOfferContext;
  contractYears?: number;
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
    const rawWage = p.contract?.wageWeekly || 0;
    // If player is loaned out, parent club only pays the remaining wage percentage
    const wage =
      p.loan && p.loan.parentClubId === clubId
        ? Math.round((rawWage * (100 - p.loan.wageContributionPct)) / 100)
        : rawWage;

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

  // Include wage commitments for players loaned IN to this club
  const loanedInPlayers = Object.values(state.players).filter(
    (p) => p.loan && p.loan.destinationClubId === clubId && p.contract && !p.isRetired
  );
  loanedInPlayers.forEach((p) => {
    const rawWage = p.contract?.wageWeekly || 0;
    const loanWageCharge = Math.round((rawWage * (p.loan?.wageContributionPct || 0)) / 100);
    totalWageBillWeekly += loanWageCharge;
    capChargeWeekly += loanWageCharge;
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

function roundWageToStep(weekly: number): number {
  return Math.max(
    CONTRACT_NEGOTIATION.MIN_WEEKLY_WAGE,
    Math.round(weekly / 50) * 50
  );
}

/**
 * Evaluates whether a player accepts a contract offer.
 * Asking wage is the preferred figure; players still accept from the soft floor
 * (~15% below ask) so negotiations have leeway.
 */
export function evaluateContractOffer(
  player: { rating: number; age: number; morale: number; form: number },
  club: { reputation: number; competitionId: string },
  offeredWage: number,
  offeredRole: SquadRole,
  options?: EvaluateContractOfferOptions
): ContractEvaluationResult {
  const marketWage = calculateMarketWage(
    player.rating,
    player.age,
    club.competitionId as "super-league" | "championship"
  );

  let roleMultiplier = 1.0;
  if (offeredRole === "star") roleMultiplier = 1.15;
  if (offeredRole === "rotation") roleMultiplier = 0.9;
  if (offeredRole === "youth" || offeredRole === "backup") roleMultiplier = 0.8;

  // Morale: happy players settle cheaper; unhappy ones push for more
  const moraleFactor = player.morale >= 80 ? 0.95 : player.morale < 60 ? 1.12 : 1.0;

  // Stronger clubs are more attractive — slight ask reduction
  const rep = club.reputation || 50;
  const reputationFactor = rep >= 80 ? 0.94 : rep >= 65 ? 0.97 : 1.0;

  const context = options?.context ?? "renewal";
  const moveFactor =
    context === "transfer" || context === "free_agent"
      ? CONTRACT_NEGOTIATION.MOVE_ASK_DISCOUNT
      : 1.0;

  const years = Math.max(1, options?.contractYears ?? 1);
  const yearFactor = Math.max(
    1 - CONTRACT_NEGOTIATION.MAX_YEAR_ASK_DISCOUNT,
    1 - Math.max(0, years - 1) * CONTRACT_NEGOTIATION.YEAR_ASK_DISCOUNT
  );

  const askingWage = roundWageToStep(
    marketWage * roleMultiplier * moraleFactor * reputationFactor * moveFactor * yearFactor
  );
  const minimumAcceptable = roundWageToStep(
    askingWage * CONTRACT_NEGOTIATION.ACCEPTANCE_FLOOR_PCT
  );

  if (offeredWage >= minimumAcceptable) {
    const negotiated = offeredWage < askingWage;
    return {
      accepted: true,
      reason: negotiated
        ? `Personal terms agreed after negotiation (£${offeredWage.toLocaleString()}/wk; agent had asked ~£${askingWage.toLocaleString()}/wk).`
        : "The player is satisfied with the financial terms and offered squad role.",
      minimumAcceptableWage: minimumAcceptable,
      askingWage,
    };
  }

  return {
    accepted: false,
    reason: `The offered wage (£${offeredWage.toLocaleString()}/wk) is below what the player will accept. They are looking for around £${askingWage.toLocaleString()}/wk (likely to accept from £${minimumAcceptable.toLocaleString()}/wk).`,
    minimumAcceptableWage: minimumAcceptable,
    askingWage,
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
  offeredRole: SquadRole,
  options?: { silent?: boolean }
): ContractOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) return { success: false, state, error: "Player is a free agent." };

  const club = state.clubs[player.clubId];
  if (!club) return { success: false, state, error: "Club not found." };

  // 1. Evaluate player acceptance
  const evaluation = evaluateContractOffer(player, club, offeredWage, offeredRole, {
    context: "renewal",
    contractYears,
  });
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

  if (options?.silent) {
    return {
      success: true,
      state: {
        ...state,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
      },
    };
  }

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

export interface BulkRenewalResult {
  success: boolean;
  state: ManagerState;
  renewedCount: number;
  failedCount: number;
  renewedNames: string[];
  failedNames: string[];
  error?: string;
}

/**
 * Bulk-renews contracts for all Academy and/or Reserves players at a club.
 * Keeps current wage when the player will accept it; otherwise bumps to their
 * minimum acceptable. Preserves squad role. Uses a single summary inbox message.
 */
export function renewAllSquadTierContracts(
  state: ManagerState,
  clubId: string,
  tiers: Array<"academy" | "reserves">,
  contractYears = 2
): BulkRenewalResult {
  const club = state.clubs[clubId];
  if (!club) {
    return {
      success: false,
      state,
      renewedCount: 0,
      failedCount: 0,
      renewedNames: [],
      failedNames: [],
      error: "Club not found.",
    };
  }

  const tierSet = new Set(tiers);
  const candidates = Object.values(state.players).filter(
    (p) =>
      p.clubId === clubId &&
      p.contract &&
      !p.isRetired &&
      p.squadTier &&
      tierSet.has(p.squadTier as "academy" | "reserves")
  );

  if (candidates.length === 0) {
    return {
      success: false,
      state,
      renewedCount: 0,
      failedCount: 0,
      renewedNames: [],
      failedNames: [],
      error: "No Academy/Reserves players available to renew.",
    };
  }

  let workingState = state;
  const renewedNames: string[] = [];
  const failedNames: string[] = [];
  const currentSeason = state.calendar.currentSeason;
  const expiresSeason = currentSeason + contractYears;

  // Renew cheapest first so salary-cap pressure hits later / lower-priority names
  const sorted = [...candidates].sort(
    (a, b) => (a.contract?.wageWeekly || 0) - (b.contract?.wageWeekly || 0)
  );

  for (const player of sorted) {
    const role: SquadRole =
      player.contract?.role ||
      (player.squadTier === "academy" ? "youth" : "rotation");
    const currentWage = player.contract?.wageWeekly || 0;
    const evaluation = evaluateContractOffer(player, club, currentWage, role, {
      context: "renewal",
      contractYears,
    });
    const offeredWage = Math.max(currentWage, evaluation.minimumAcceptableWage);

    const res = renewPlayerContract(
      workingState,
      player.id,
      offeredWage,
      contractYears,
      role,
      { silent: true }
    );
    if (res.success) {
      workingState = res.state;
      renewedNames.push(player.name);
    } else {
      failedNames.push(player.name);
    }
  }

  if (renewedNames.length === 0) {
    return {
      success: false,
      state,
      renewedCount: 0,
      failedCount: failedNames.length,
      renewedNames,
      failedNames,
      error:
        failedNames.length > 0
          ? `Could not renew any contracts (salary cap or terms). Failed: ${failedNames.slice(0, 3).join(", ")}${failedNames.length > 3 ? "…" : ""}`
          : "No contracts renewed.",
    };
  }

  const tierLabel =
    tiers.length === 2
      ? "Academy & Reserves"
      : tiers[0] === "academy"
        ? "Academy"
        : "Reserves";

  const summaryBody = [
    `${renewedNames.length} ${tierLabel} contract${renewedNames.length === 1 ? "" : "s"} extended by ${contractYears} year${contractYears === 1 ? "" : "s"} (until end of ${expiresSeason}).`,
    "",
    `Renewed: ${renewedNames.join(", ")}.`,
    failedNames.length > 0
      ? `\nCould not renew (${failedNames.length}): ${failedNames.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const nextState: ManagerState = {
    ...workingState,
    inbox: {
      ...workingState.inbox,
      messages: [
        {
          id: `contract_bulk_renewed_${tiers.join("_")}_${Date.now()}`,
          season: currentSeason,
          week: workingState.calendar.currentWeek,
          dateStr: `Season ${currentSeason}`,
          sender: "Club Secretary",
          subject: `${tierLabel} Contracts Renewed (${renewedNames.length})`,
          body: summaryBody,
          category: "contract",
          isRead: false,
        },
        ...workingState.inbox.messages,
      ],
      unreadCount: workingState.inbox.unreadCount + 1,
    },
  };

  return {
    success: true,
    state: nextState,
    renewedCount: renewedNames.length,
    failedCount: failedNames.length,
    renewedNames,
    failedNames,
  };
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
  const evaluation = evaluateContractOffer(player, club, offeredWage, offeredRole, {
    context: "free_agent",
    contractYears,
  });
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

/** Campaign length treated as ~8 calendar months (Feb–Oct). */
const SEASON_CAMPAIGN_MONTHS = 8;

/**
 * Approximate months remaining on a deal that ends at the close of `expiresSeason`.
 * Used for the "< 6 months left" contract warning popup.
 */
export function estimateContractMonthsRemaining(
  currentSeason: number,
  currentWeek: number,
  expiresSeason: number,
  totalWeeks: number = CALENDAR_RULES.TOTAL_WEEKS
): number {
  if (expiresSeason < currentSeason) return 0;
  if (expiresSeason > currentSeason) {
    // Full future seasons remain — well beyond the 6-month warning window
    return (expiresSeason - currentSeason) * 12;
  }

  const weeksLeft = Math.max(0, totalWeeks - currentWeek + 1);
  return (weeksLeft / totalWeeks) * SEASON_CAMPAIGN_MONTHS;
}

export function isContractUnderSixMonths(
  currentSeason: number,
  currentWeek: number,
  expiresSeason: number
): boolean {
  return estimateContractMonthsRemaining(currentSeason, currentWeek, expiresSeason) < 6;
}

/**
 * User-club players whose contracts have less than 6 months remaining.
 * Skips retired players and free agents.
 */
export function getPlayersWithUnderSixMonthsLeft(
  state: ManagerState,
  clubId: string
): ManagerPlayer[] {
  const { currentSeason, currentWeek } = state.calendar;
  return Object.values(state.players)
    .filter(
      (p) =>
        p.clubId === clubId &&
        !!p.contract &&
        !p.isRetired &&
        isContractUnderSixMonths(currentSeason, currentWeek, p.contract.expiresSeason)
    )
    .sort((a, b) => {
      const tierRank = (t: string | null) =>
        t === "first" ? 0 : t === "reserves" ? 1 : 2;
      const td = tierRank(a.squadTier) - tierRank(b.squadTier);
      if (td !== 0) return td;
      return b.rating - a.rating;
    });
}

/**
 * Players entering the <6-month window who have not yet been acknowledged this season.
 */
export function getUnacknowledgedContractExpiryWarnings(
  state: ManagerState,
  clubId: string
): ManagerPlayer[] {
  const players = getPlayersWithUnderSixMonthsLeft(state, clubId);
  const ack = state.settings?.contractExpiryAcknowledged;
  if (!ack || ack.season !== state.calendar.currentSeason) {
    return players;
  }
  const seen = new Set(ack.playerIds);
  return players.filter((p) => !seen.has(p.id));
}

/**
 * Marks the given players as acknowledged for this season's expiry popup.
 */
export function acknowledgeContractExpiryWarnings(
  state: ManagerState,
  playerIds: string[]
): ManagerState {
  const season = state.calendar.currentSeason;
  const prev = state.settings?.contractExpiryAcknowledged;
  const existing = prev && prev.season === season ? prev.playerIds : [];
  const merged = Array.from(new Set([...existing, ...playerIds]));

  return {
    ...state,
    settings: {
      ...state.settings,
      contractExpiryAcknowledged: {
        season,
        playerIds: merged,
      },
    },
  };
}
