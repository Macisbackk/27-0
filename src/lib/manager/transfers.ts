/**
 * Transfer market: listings, bids, valuation, negotiations, and transaction execution.
 * Pure simulation logic.
 */

import { calculateSalaryCapUsage, evaluateContractOffer } from "./contracts";
import { CALENDAR_RULES, calculatePlayerValue } from "./rules";
import type {
  ManagerState,
  SquadRole,
  TransferBid,
} from "./types";

export interface TransferOperationResult {
  success: boolean;
  state: ManagerState;
  error?: string;
  bid?: TransferBid;
}

/**
 * Toggles a player's transfer list status.
 */
export function setPlayerTransferListed(
  state: ManagerState,
  playerId: string,
  isListed: boolean
): TransferOperationResult {
  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) return { success: false, state, error: "Free agents cannot be transfer listed by a club." };

  const updatedPlayer = {
    ...player,
    isTransferListed: isListed,
  };

  const listedIds = new Set(state.transfers.listedPlayerIds);
  if (isListed) {
    listedIds.add(playerId);
  } else {
    listedIds.delete(playerId);
  }

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    transfers: {
      ...state.transfers,
      listedPlayerIds: Array.from(listedIds),
    },
  };

  return { success: true, state: nextState };
}

/**
 * Submits a transfer bid from one club to another.
 */
export function submitTransferBid(
  state: ManagerState,
  fromClubId: string,
  playerId: string,
  offeredFee: number,
  offeredWage: number,
  offeredRole: SquadRole,
  contractYears: number
): TransferOperationResult {
  // 1. Transfer window validation
  if (state.calendar.currentWeek > CALENDAR_RULES.TRANSFER_WINDOW_DEADLINE_WEEK) {
    return {
      success: false,
      state,
      error: `Transfer window is closed. (Deadline was Round ${CALENDAR_RULES.TRANSFER_WINDOW_DEADLINE_WEEK}).`,
    };
  }

  const player = state.players[playerId];
  if (!player) return { success: false, state, error: "Player not found." };
  if (!player.clubId) return { success: false, state, error: "Use Free Agent signing for unattached players." };
  if (player.clubId === fromClubId) return { success: false, state, error: "Cannot submit a bid for your own player." };

  const buyingClub = state.clubs[fromClubId];
  const sellingClub = state.clubs[player.clubId];
  if (!buyingClub || !sellingClub) return { success: false, state, error: "Invalid clubs involved in bid." };

  // 2. Budget and cash check
  if (buyingClub.finances.balance < offeredFee) {
    return {
      success: false,
      state,
      error: `Insufficient Funds: Transfer fee of £${offeredFee.toLocaleString()} exceeds available balance (£${buyingClub.finances.balance.toLocaleString()}).`,
    };
  }

  // 3. Salary cap preview check
  const cap = calculateSalaryCapUsage(state, fromClubId);
  if (cap.availableCapWeekly < offeredWage) {
    return {
      success: false,
      state,
      error: `Salary Cap Breach: Wage offer (£${offeredWage.toLocaleString()}/wk) exceeds available cap room (£${Math.max(0, cap.availableCapWeekly).toLocaleString()}/wk).`,
    };
  }

  const bidId = `bid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const bid: TransferBid = {
    id: bidId,
    season: state.calendar.currentSeason,
    week: state.calendar.currentWeek,
    playerId,
    fromClubId,
    toClubId: player.clubId,
    offeredFee,
    offeredWage,
    offeredRole,
    offeredContractYears: contractYears,
    status: "pending_club",
  };

  const nextState: ManagerState = {
    ...state,
    transfers: {
      ...state.transfers,
      activeBids: [bid, ...state.transfers.activeBids],
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `inbox_bid_sub_${bidId}`,
          season: state.calendar.currentSeason,
          week: state.calendar.currentWeek,
          dateStr: `Week ${state.calendar.currentWeek}`,
          sender: "Transfer Desk",
          subject: `Bid Submitted: £${offeredFee.toLocaleString()} for ${player.name}`,
          body: `An official transfer bid of £${offeredFee.toLocaleString()} has been lodged with ${sellingClub.name} for ${player.name}.`,
          category: "transfer",
          isRead: false,
        },
        ...state.inbox.messages,
      ],
      unreadCount: state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState, bid };
}

/**
 * Selling club considers and evaluates a transfer bid.
 */
export function evaluateSellingClubBid(
  state: ManagerState,
  bidId: string,
  forceDecision?: "accept" | "reject"
): TransferOperationResult {
  const bid = state.transfers.activeBids.find((b) => b.id === bidId);
  if (!bid) return { success: false, state, error: "Bid not found." };
  if (bid.status !== "pending_club") return { success: false, state, error: `Bid is already ${bid.status}` };

  const player = state.players[bid.playerId];
  const sellingClub = state.clubs[bid.toClubId];
  const buyingClub = state.clubs[bid.fromClubId];
  if (!player || !sellingClub || !buyingClub) return { success: false, state, error: "Data integrity error for bid." };

  const fairValue = calculatePlayerValue(player.rating, player.potential, player.age);

  // If forced (e.g. human manager accepting/rejecting via UI)
  let accepted = forceDecision === "accept";
  let reason = "";

  if (forceDecision === undefined) {
    // AI Selling Club decision logic
    let valueMultiplier = 1.0;
    if (player.contract?.role === "star") valueMultiplier = 1.3;
    if (player.isTransferListed) valueMultiplier = 0.85;

    const minimumRequiredFee = Math.round(fairValue * valueMultiplier);

    if (bid.offeredFee >= minimumRequiredFee) {
      accepted = true;
      reason = `${sellingClub.name} has accepted the transfer offer of £${bid.offeredFee.toLocaleString()}.`;
    } else {
      accepted = false;
      reason = `${sellingClub.name} rejected the offer. They value ${player.name} at no less than £${minimumRequiredFee.toLocaleString()}.`;
    }
  } else {
    reason = accepted
      ? `${sellingClub.name} accepted the transfer offer.`
      : `${sellingClub.name} rejected the transfer offer.`;
  }

  const nextStatus = accepted ? "club_accepted" : "club_rejected";
  const updatedBid: TransferBid = {
    ...bid,
    status: nextStatus,
    rejectionReason: accepted ? undefined : reason,
  };

  const updatedBids = state.transfers.activeBids.map((b) => (b.id === bidId ? updatedBid : b));

  const nextState: ManagerState = {
    ...state,
    transfers: {
      ...state.transfers,
      activeBids: updatedBids,
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `inbox_club_eval_${bidId}`,
          season: state.calendar.currentSeason,
          week: state.calendar.currentWeek,
          dateStr: `Week ${state.calendar.currentWeek}`,
          sender: `${sellingClub.name} Board`,
          subject: accepted ? `Transfer Offer Accepted: ${player.name}` : `Transfer Offer Rejected: ${player.name}`,
          body: reason,
          category: "transfer",
          isRead: false,
        },
        ...state.inbox.messages,
      ],
      unreadCount: state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState, bid: updatedBid };
}

/**
 * Player considers personal terms once club has accepted the transfer bid.
 */
export function evaluatePlayerTransferTerms(
  state: ManagerState,
  bidId: string
): TransferOperationResult {
  const bid = state.transfers.activeBids.find((b) => b.id === bidId);
  if (!bid) return { success: false, state, error: "Bid not found." };
  if (bid.status !== "club_accepted") return { success: false, state, error: "Club has not accepted the bid." };

  const player = state.players[bid.playerId];
  const buyingClub = state.clubs[bid.fromClubId];
  if (!player || !buyingClub) return { success: false, state, error: "Invalid bid data." };

  // Evaluate personal contract terms
  const evaluation = evaluateContractOffer(player, buyingClub, bid.offeredWage, bid.offeredRole);

  const updatedBid: TransferBid = {
    ...bid,
    status: evaluation.accepted ? "player_accepted" : "player_rejected",
    rejectionReason: evaluation.accepted ? undefined : evaluation.reason,
  };

  const updatedBids = state.transfers.activeBids.map((b) => (b.id === bidId ? updatedBid : b));

  const nextState: ManagerState = {
    ...state,
    transfers: {
      ...state.transfers,
      activeBids: updatedBids,
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `inbox_player_eval_${bidId}`,
          season: state.calendar.currentSeason,
          week: state.calendar.currentWeek,
          dateStr: `Week ${state.calendar.currentWeek}`,
          sender: `${player.name}'s Agent`,
          subject: evaluation.accepted ? `Personal Terms Agreed: ${player.name}` : `Contract Terms Rejected: ${player.name}`,
          body: evaluation.reason,
          category: "transfer",
          isRead: false,
        },
        ...state.inbox.messages,
      ],
      unreadCount: state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState, bid: updatedBid };
}

/**
 * Authoritative completion of a transfer once both club and player have accepted.
 * Transfers fee, updates player ownership, contract, and cleans old lineup slots.
 */
export function completeTransfer(
  state: ManagerState,
  bidId: string
): TransferOperationResult {
  const bid = state.transfers.activeBids.find((b) => b.id === bidId);
  if (!bid) return { success: false, state, error: "Bid not found." };
  if (bid.status !== "player_accepted") {
    return { success: false, state, error: `Cannot complete transfer when status is ${bid.status}.` };
  }

  const player = state.players[bid.playerId];
  const buyingClub = state.clubs[bid.fromClubId];
  const sellingClub = state.clubs[bid.toClubId];
  if (!player || !buyingClub || !sellingClub) return { success: false, state, error: "Data integrity error for transfer." };

  // Final check: funds and salary cap
  if (buyingClub.finances.balance < bid.offeredFee) {
    return { success: false, state, error: "Buying club no longer has funds to pay transfer fee." };
  }
  const cap = calculateSalaryCapUsage(state, buyingClub.id);
  if (cap.availableCapWeekly < bid.offeredWage) {
    return { success: false, state, error: "Buying club salary cap would be breached." };
  }

  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  // 1. Deduct fee from buyer, add fee to seller
  const updatedBuyerFinances = {
    ...buyingClub.finances,
    balance: buyingClub.finances.balance - bid.offeredFee,
    seasonExpenses: buyingClub.finances.seasonExpenses + bid.offeredFee,
    history: [
      {
        id: `tx_buy_${bid.id}`,
        season: currentSeason,
        week: currentWeek,
        amount: -bid.offeredFee,
        category: "transfers_out" as const,
        description: `Transfer fee paid to ${sellingClub.name} for ${player.name}`,
      },
      ...buyingClub.finances.history,
    ],
  };

  const updatedSellerFinances = {
    ...sellingClub.finances,
    balance: sellingClub.finances.balance + bid.offeredFee,
    seasonRevenue: sellingClub.finances.seasonRevenue + bid.offeredFee,
    history: [
      {
        id: `tx_sell_${bid.id}`,
        season: currentSeason,
        week: currentWeek,
        amount: bid.offeredFee,
        category: "transfers_in" as const,
        description: `Transfer fee received from ${buyingClub.name} for ${player.name}`,
      },
      ...sellingClub.finances.history,
    ],
  };

  // 2. Clean selling club's lineup
  const sellerStarting13 = sellingClub.lineup.starting13.map(id => id === player.id ? null : id);
  const sellerBench = sellingClub.lineup.bench.map(id => id === player.id ? null : id);

  const updatedSellingClub = {
    ...sellingClub,
    finances: updatedSellerFinances,
    lineup: { starting13: sellerStarting13, bench: sellerBench },
  };

  const updatedBuyingClub = {
    ...buyingClub,
    finances: updatedBuyerFinances,
  };

  // 3. Update player
  const updatedPlayer = {
    ...player,
    clubId: buyingClub.id,
    squadTier: "first" as const,
    isTransferListed: false,
    contract: {
      wageWeekly: bid.offeredWage,
      expiresSeason: currentSeason + bid.offeredContractYears,
      role: bid.offeredRole,
    },
    morale: 90,
  };

  // 4. Update bid status
  const updatedBid: TransferBid = {
    ...bid,
    status: "completed",
  };

  const nextBids = state.transfers.activeBids.map((b) => (b.id === bidId ? updatedBid : b));
  const nextCompleted = [
    {
      id: `completed_${bid.id}`,
      season: currentSeason,
      week: currentWeek,
      playerId: player.id,
      playerName: player.name,
      fromClubId: sellingClub.id,
      toClubId: buyingClub.id,
      fee: bid.offeredFee,
      wageWeekly: bid.offeredWage,
      contractYears: bid.offeredContractYears,
    },
    ...state.transfers.completedTransfers,
  ];

  const nextListed = state.transfers.listedPlayerIds.filter((id) => id !== player.id);

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [player.id]: updatedPlayer,
    },
    clubs: {
      ...state.clubs,
      [sellingClub.id]: updatedSellingClub,
      [buyingClub.id]: updatedBuyingClub,
    },
    transfers: {
      ...state.transfers,
      activeBids: nextBids,
      completedTransfers: nextCompleted,
      listedPlayerIds: nextListed,
    },
    inbox: {
      ...state.inbox,
      messages: [
        {
          id: `inbox_transfer_done_${bid.id}`,
          season: currentSeason,
          week: currentWeek,
          dateStr: `Week ${currentWeek}`,
          sender: "Rugby Football League",
          subject: `Transfer Completed: ${player.name} to ${buyingClub.name}`,
          body: `${player.name} has officially completed a £${bid.offeredFee.toLocaleString()} transfer from ${sellingClub.name} to ${buyingClub.name}.`,
          category: "transfer",
          isRead: false,
        },
        ...state.inbox.messages,
      ],
      unreadCount: state.inbox.unreadCount + 1,
    },
  };

  return { success: true, state: nextState, bid: updatedBid };
}
