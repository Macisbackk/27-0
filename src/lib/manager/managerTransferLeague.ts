import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getManagerClubConfig } from "./club-config";
import type {
  InboxMessage,
  LeagueListedPlayer,
  ManagerCareer,
  PlayerTransferStatus,
  SquadRole,
} from "./types";
import {
  calculateWageForPlayer,
  computeWageBill,
  formatWage,
  generateInitialContract,
  inferSquadRole,
} from "./managerContracts";
import { getManagerClubTeamRating } from "./managerRating";
import { getManagerModePlayerRating } from "./managerSquadRatings";
import {
  findPlayerLeagueClub,
  getLeagueClubRosterIds,
  getUserClubPlayerIds,
  pruneLeagueListedPlayers,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { getManagerPlayer } from "./managerPlayers";
import { getTransferDemand } from "./managerTransfers";
import { createInitialPlayerState } from "./managerSquad";
import { addPlayersToFreeAgents, completeFreeAgentSigning, isFreeAgent } from "./managerFreeAgents";
import { syncManagerFinance, deductTransferFee, addTransferIncome, getTransferBudget, canAffordAdditionalWage } from "./managerFinance";
import { computeCareerWageBill } from "./managerReserveContracts";
import {
  createPlayerSaleMessage,
  createPlayerPurchaseMessage,
  pushInboxMessage,
  normalizeInboxMessage,
} from "./managerInbox";

function invalidatePlayerTransferOffers(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const nextTransfer = { ...career.playerTransferStatus };
  delete nextTransfer[playerId];
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.playerId === playerId &&
      !m.resolved &&
      (m.type === "transfer" || m.type === "transfer_offer_in")
        ? { ...m, resolved: true, read: true }
        : m
    ),
    leagueListedPlayers: career.leagueListedPlayers.filter(
      (row) => row.playerId !== playerId
    ),
    playerTransferStatus: nextTransfer,
  };
}

export function initClubFunds(userClub: string): Record<string, number> {
  const funds: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    funds[club] = getManagerClubConfig(club).budget;
  }
  funds[userClub] = getManagerClubConfig(userClub).budget;
  return funds;
}

function getPlayerListingRating(
  career: ManagerCareer,
  playerId: string
): number {
  const player = getManagerPlayer(career, playerId);
  if (!player) return 0;
  return getManagerModePlayerRating(
    playerId,
    player.name,
    player.rating ?? player.peakRating
  );
}

/** Each club's top-rated player(s) are never transfer-listed. */
export function getProtectedTransferPlayerIds(
  career: ManagerCareer,
  club: string
): Set<string> {
  const roster = getLeagueClubRosterIds(career, club);
  let topRating = 0;
  for (const id of roster) {
    topRating = Math.max(topRating, getPlayerListingRating(career, id));
  }
  if (topRating <= 0) return new Set();

  const protectedIds = new Set<string>();
  for (const id of roster) {
    if (getPlayerListingRating(career, id) === topRating) {
      protectedIds.add(id);
    }
  }
  return protectedIds;
}

function getListableClubPlayers(
  career: ManagerCareer,
  club: string
): { id: string; rating: number }[] {
  const protectedIds = getProtectedTransferPlayerIds(career, club);
  return getLeagueClubRosterIds(career, club)
    .map((id) => {
      if (protectedIds.has(id)) return null;
      const rating = getPlayerListingRating(career, id);
      if (rating <= 0) return null;
      return { id, rating };
    })
    .filter((row): row is { id: string; rating: number } => row !== null);
}

function pickWeightedListablePlayer(
  pool: { id: string; rating: number }[],
  rng: () => number
): string | null {
  if (pool.length === 0) return null;
  const clubBest = Math.max(...pool.map((row) => row.rating));
  const weighted = pool.map((row) => {
    const belowBest = Math.max(0, clubBest - row.rating);
    // Fringe players list often; near-best squad members only occasionally.
    const weight = Math.pow(belowBest + 2, 1.55);
    return { id: row.id, weight };
  });
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  let roll = rng() * total;
  for (const row of weighted) {
    roll -= row.weight;
    if (roll <= 0) return row.id;
  }
  return weighted[weighted.length - 1]!.id;
}

export function generateLeagueListedPlayers(
  career: ManagerCareer,
  seed: string,
  gameWeek: number
): LeagueListedPlayer[] {
  const rng = seedrandom(`${seed}-league-listed-w${gameWeek}`);
  const listed: LeagueListedPlayer[] = [];

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;

    const pool = getListableClubPlayers(career, club);
    if (pool.length === 0) continue;

    const listCount = Math.min(pool.length, 1 + Math.floor(rng() * 3));
    const remaining = [...pool];

    for (let i = 0; i < listCount; i++) {
      const playerId = pickWeightedListablePlayer(remaining, rng);
      if (!playerId) break;

      const player = getPlayerById(playerId);
      if (!player) continue;

      const mult = 0.8 + rng() * 0.4;
      listed.push({
        playerId,
        club,
        askingPrice: Math.round(player.value * mult),
        listedAtWeek: gameWeek,
      });

      const pickedIndex = remaining.findIndex((row) => row.id === playerId);
      if (pickedIndex >= 0) remaining.splice(pickedIndex, 1);
    }
  }

  return listed.sort((a, b) => {
    const clubCmp = a.club.localeCompare(b.club);
    if (clubCmp !== 0) return clubCmp;
    return (
      getPlayerListingRating(career, a.playerId) -
      getPlayerListingRating(career, b.playerId)
    );
  });
}

export function getAskingPrice(
  playerId: string,
  listed: boolean,
  seed: string,
  round: number
): number {
  const player = getPlayerById(playerId);
  if (!player) return 0;
  const rng = seedrandom(`${seed}-price-${playerId}-r${round}`);
  if (listed) {
    return Math.round(player.value * (0.8 + rng() * 0.4));
  }
  return Math.round(player.value * (1.5 + rng() * 1.0));
}

export function getLeagueListingAskingPrice(
  career: ManagerCareer,
  playerId: string,
  club?: string
): number | null {
  const entry = club
    ? career.leagueListedPlayers.find(
        (l) => l.playerId === playerId && l.club === club
      )
    : career.leagueListedPlayers.find((l) => l.playerId === playerId);
  return entry?.askingPrice ?? null;
}

/** Asking price the selling club will hold out for (listed fee from the transfer list). */
export function getSellerAskingPrice(
  career: ManagerCareer,
  playerId: string,
  club: string,
  listed: boolean
): number {
  if (listed) {
    const listedPrice = getLeagueListingAskingPrice(career, playerId, club);
    if (listedPrice != null) return listedPrice;
  }
  return getAskingPrice(playerId, listed, career.seed, career.gameWeek);
}

export function listPlayerForTransfer(
  career: ManagerCareer,
  playerId: string,
  askingPrice: number
): ManagerCareer {
  const player = getPlayerById(playerId);
  if (!player) return career;

  const status: PlayerTransferStatus = {
    listed: true,
    askingPrice,
    listedAtGameWeek: career.gameWeek,
  };

  return {
    ...career,
    playerTransferStatus: {
      ...career.playerTransferStatus,
      [playerId]: status,
    },
    updatedAt: new Date().toISOString(),
  };
}

/** List player and roll for an immediate incoming offer. */
export function listPlayerForTransferWithOffers(
  career: ManagerCareer,
  playerId: string,
  askingPrice: number
): ManagerCareer {
  return generateIncomingTransferOffers(
    listPlayerForTransfer(career, playerId, askingPrice)
  );
}

export function unlistPlayerFromTransfer(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const next = { ...career.playerTransferStatus };
  delete next[playerId];
  return { ...career, playerTransferStatus: next };
}

export function computeReleaseCost(career: ManagerCareer, playerId: string): number {
  const contract = career.contracts[playerId];
  if (!contract) return 0;
  return contract.wagePerYear * contract.yearsRemaining;
}

export function releasePlayerWithCost(
  career: ManagerCareer,
  playerId: string
): { ok: boolean; career?: ManagerCareer; error?: string; cost?: number } {
  const cost = computeReleaseCost(career, playerId);
  const transferBudget =
    career.managerFinance?.transferBudget ?? career.budget;
  if (transferBudget < cost) {
    return {
      ok: false,
      error: `Cannot afford release settlement (${formatWage(cost)} required)`,
      cost,
    };
  }

  const player = getPlayerById(playerId);
  const xiii = career.matchdayXiii.map((id) => (id === playerId ? "" : id));
  const interchange = career.matchdayInterchange.map((id) =>
    id === playerId ? "" : id
  );
  const nextContracts = { ...career.contracts };
  delete nextContracts[playerId];

  const msg = normalizeInboxMessage(
    {
      id: `release-${playerId}-${Date.now()}`,
      type: "release",
      title: "Player Released",
      body: `${player?.name ?? "Player"} released. Settlement paid: ${formatWage(cost)}.`,
      read: true,
      resolved: true,
      playerId,
      playerName: player?.name,
    },
    career
  );

  let nextCareer: ManagerCareer = invalidatePlayerTransferOffers(
    {
      ...career,
      squad: career.squad.filter((p) => p.playerId !== playerId),
      contracts: nextContracts,
      wageBill: computeCareerWageBill({
        ...career,
        contracts: nextContracts,
      } as ManagerCareer),
      matchdayXiii: xiii,
      matchdayInterchange: interchange,
      inboxMessages: [msg, ...career.inboxMessages],
      updatedAt: new Date().toISOString(),
    },
    playerId
  );

  if (cost > 0) {
    nextCareer = deductTransferFee(nextCareer, cost);
  }
  nextCareer = addPlayersToFreeAgents(nextCareer, [
    { playerId, formerClub: career.club },
  ]);
  nextCareer = syncManagerFinance(nextCareer);

  return {
    ok: true,
    cost,
    career: nextCareer,
  };
}

export interface BuyOffer {
  transferFee: number;
  wagePerYear: number;
  yearsRequested: number;
  squadRole: SquadRole;
}

/** Rare acceptance when a bid is close to, but under, the seller's minimum. */
function trySellerAcceptsReducedFee(
  career: ManagerCareer,
  playerId: string,
  offerFee: number,
  minFee: number,
  listed: boolean
): boolean {
  const floorRatio = listed ? 0.92 : 0.96;
  if (offerFee >= minFee || offerFee < minFee * floorRatio) return false;

  const ratio = offerFee / minFee;
  const rng = seedrandom(
    `${career.seed}-transfer-nego-${playerId}-${offerFee}-w${career.gameWeek}`
  );

  let chance = 0;
  if (listed) {
    if (ratio >= 0.98) chance = 0.2;
    else if (ratio >= 0.95) chance = 0.11;
    else if (ratio >= 0.92) chance = 0.05;
  } else if (ratio >= 0.99) {
    chance = 0.12;
  } else if (ratio >= 0.97) {
    chance = 0.06;
  }

  return rng() < chance;
}

export function evaluateBuyOffer(
  career: ManagerCareer,
  playerId: string,
  club: string,
  offer: BuyOffer,
  listed: boolean
): { accepted: boolean; reason: string } {
  const player = getPlayerById(playerId);
  if (!player) return { accepted: false, reason: "Player not found" };

  if (isFreeAgent(career, playerId)) {
    return {
      accepted: false,
      reason: "This player is a free agent — sign them without a transfer fee.",
    };
  }

  const sellerClub = findPlayerLeagueClub(career, playerId);
  if (!isFreeAgent(career, playerId) && sellerClub !== club) {
    return { accepted: false, reason: "Player is no longer at that club." };
  }

  if (
    !listed &&
    getProtectedTransferPlayerIds(career, club).has(playerId)
  ) {
    return {
      accepted: false,
      reason: "Club considers this player not for sale.",
    };
  }

  const asking = getSellerAskingPrice(career, playerId, club, listed);
  const minFee = listed ? asking : asking * 1.1;
  let feeAcceptedSoftly = false;

  if (offer.transferFee < minFee) {
    if (
      trySellerAcceptsReducedFee(
        career,
        playerId,
        offer.transferFee,
        minFee,
        listed
      )
    ) {
      feeAcceptedSoftly = true;
    } else {
      return {
        accepted: false,
        reason: listed
          ? "Transfer fee too low."
          : "Club unwilling to sell — fee too low for an unlisted player.",
      };
    }
  }
  if (getTransferBudget(career) < offer.transferFee) {
    return { accepted: false, reason: "Insufficient transfer budget." };
  }

  const demand = getTransferDemand(career, playerId);
  const rating = player.rating ?? player.peakRating ?? 70;
  if (offer.wagePerYear < demand.wagePerYear * 0.9) {
    return { accepted: false, reason: "Wage offer too low." };
  }
  if (offer.yearsRequested < demand.yearsRequested && rating >= 75) {
    return {
      accepted: false,
      reason: "Player wants a longer contract.",
    };
  }
  if (!canAffordAdditionalWage(career, offer.wagePerYear)) {
    return { accepted: false, reason: "Wage bill would exceed budget." };
  }
  if (career.squad.length >= 35) {
    return { accepted: false, reason: "Squad is full." };
  }

  return {
    accepted: true,
    reason: feeAcceptedSoftly
      ? "Selling club accepted slightly below their valuation."
      : "Deal agreed.",
  };
}

export function completePlayerPurchase(
  career: ManagerCareer,
  playerId: string,
  club: string,
  offer: BuyOffer,
  listed: boolean
): ManagerCareer {
  if (isFreeAgent(career, playerId)) {
    return completeFreeAgentSigning(career, playerId, {
      ...offer,
      transferFee: 0,
    });
  }

  const sellerClub = findPlayerLeagueClub(career, playerId);
  if (!isFreeAgent(career, playerId) && sellerClub !== club) {
    return career;
  }

  const rep = getManagerClubTeamRating(career.club);
  const demand = getTransferDemand(career, playerId);
  const contract = generateInitialContract(playerId, false, rep, career);
  contract.wagePerYear = offer.wagePerYear;
  contract.yearsRemaining = offer.yearsRequested;
  contract.squadRole = demand.squadRole;
  contract.expiresAtSeasonEnd = offer.yearsRequested <= 1;
  contract.purchaseFee = offer.transferFee;

  const nextContracts = { ...career.contracts, [playerId]: contract };
  const nextListed = career.leagueListedPlayers.filter(
    (l) => l.playerId !== playerId
  );

  const sellerFunds = { ...career.clubFunds };
  sellerFunds[club] = (sellerFunds[club] ?? 0) + offer.transferFee;

  const purchased: ManagerCareer = deductTransferFee(
    syncManagerFinance(
      transferLeaguePlayer(
        {
          ...career,
          clubFunds: sellerFunds,
          squad: [...career.squad, createInitialPlayerState(playerId)],
          contracts: nextContracts,
          wageBill: computeCareerWageBill({
            ...career,
            contracts: nextContracts,
          } as ManagerCareer),
          leagueListedPlayers: nextListed,
          transferMarket: [
            ...new Set([
              ...nextListed.map((l) => l.playerId),
              ...career.transferMarket.filter(
                (id) => career.playerTransferStatus[id]?.listed
              ),
            ]),
          ],
          updatedAt: new Date().toISOString(),
        },
        playerId,
        club,
        career.club
      )
    ),
    offer.transferFee
  );

  const player = getPlayerById(playerId);
  return pruneLeagueListedPlayers(
    pushInboxMessage(
      purchased,
      createPlayerPurchaseMessage(
        purchased,
        playerId,
        player?.name ?? "Player",
        club,
        offer.transferFee,
        offer.wagePerYear
      )
    )
  );
}

export function generateIncomingTransferOffers(
  career: ManagerCareer
): ManagerCareer {
  const rng = seedrandom(`${career.seed}-offers-w${career.gameWeek}`);
  const messages = [...career.inboxMessages];
  const clubFunds = { ...career.clubFunds };

  for (const [playerId, status] of Object.entries(career.playerTransferStatus)) {
    if (!status.listed) continue;
    if (messages.some((m) => !m.resolved && m.playerId === playerId)) continue;

    const player = getPlayerById(playerId);
    if (!player) continue;

    const rating = player.rating ?? player.peakRating;
    const priceRatio = status.askingPrice / Math.max(1, player.value);
    let chance = 0.12;
    if (priceRatio <= 1.1) chance += 0.2;
    if (priceRatio > 1.5) chance -= 0.1;
    if (rating >= 82) chance += 0.1;
    if (rating < 74) chance -= 0.05;

    if (rng() > chance) continue;

    const buyers = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== career.club);
    const buyer = buyers[Math.floor(rng() * buyers.length)]!;
    const funds = clubFunds[buyer] ?? getManagerClubConfig(buyer).budget;
    const offerAmount = Math.round(
      status.askingPrice * (0.75 + rng() * 0.2)
    );

    if (offerAmount > funds * 0.4) continue;

    messages.unshift({
      id: `offer-${playerId}-${career.gameWeek}-${Math.floor(rng() * 10000)}`,
      type: "transfer",
      title: "Transfer Offer",
      body: `${buyer} have offered ${formatWage(offerAmount)} for ${player.name}. Your asking price: ${formatWage(status.askingPrice)}.`,
      week: career.gameWeek,
      season: career.seasonYear,
      gameWeek: career.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      resolved: false,
      playerId,
      playerName: player.name,
      offerClub: buyer,
      offerAmount,
      askingPrice: status.askingPrice,
    });
  }

  return { ...career, inboxMessages: messages };
}

/** Uncommon post-match approaches for unlisted squad players in good form. */
export function generateUnsolicitedTransferOffers(
  career: ManagerCareer
): ManagerCareer {
  const rng = seedrandom(`${career.seed}-unsolicited-w${career.gameWeek}`);

  if (rng() > 0.05) return career;

  if (
    career.inboxMessages.some((m) => !m.resolved && m.unsolicited)
  ) {
    return career;
  }

  const listedIds = new Set(
    Object.entries(career.playerTransferStatus)
      .filter(([, status]) => status.listed)
      .map(([id]) => id)
  );
  const protectedIds = getProtectedTransferPlayerIds(career, career.club);

  const candidates = career.squad
    .map((ps) => {
      if (listedIds.has(ps.playerId) || protectedIds.has(ps.playerId)) {
        return null;
      }
      if (ps.injury) return null;

      const player = getPlayerById(ps.playerId);
      if (!player) return null;

      const rating = player.rating ?? player.peakRating;
      const formBoost = Math.max(0, ps.form - 50) / 45;
      const triesBoost = Math.min(ps.seasonTries * 0.18, 0.55);
      const appsBoost = ps.seasonAppearances >= 3 ? 0.12 : 0;
      const ratingBoost =
        rating >= 85 ? 0.3 : rating >= 80 ? 0.18 : rating >= 76 ? 0.08 : 0;
      const weight = 0.35 + formBoost + triesBoost + appsBoost + ratingBoost;

      return { ps, player, weight };
    })
    .filter(
      (
        row
      ): row is {
        ps: (typeof career.squad)[number];
        player: NonNullable<ReturnType<typeof getPlayerById>>;
        weight: number;
      } => row !== null
    );

  if (candidates.length === 0) return career;

  const totalWeight = candidates.reduce((sum, row) => sum + row.weight, 0);
  let roll = rng() * totalWeight;
  let picked = candidates[0]!;
  for (const row of candidates) {
    roll -= row.weight;
    if (roll <= 0) {
      picked = row;
      break;
    }
  }

  const { ps, player } = picked;
  const impliedPrice = getAskingPrice(
    ps.playerId,
    false,
    career.seed,
    career.gameWeek
  );
  const buyers = CURRENT_PLAYABLE_CLUBS.filter((club) => club !== career.club);
  const buyer = buyers[Math.floor(rng() * buyers.length)]!;
  const funds = career.clubFunds[buyer] ?? getManagerClubConfig(buyer).budget;
  const offerAmount = Math.round(impliedPrice * (0.9 + rng() * 0.1));

  if (offerAmount > funds * 0.35) return career;

  return pushInboxMessage(career, {
    id: `unsolicited-${ps.playerId}-${career.gameWeek}-${Math.floor(rng() * 10000)}`,
    type: "transfer",
    title: "Transfer Approach",
    body: `${buyer} want to sign ${player.name}, who is not on the transfer list. They've offered ${formatWage(offerAmount)}.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId: ps.playerId,
    playerName: player.name,
    offerClub: buyer,
    offerAmount,
    askingPrice: impliedPrice,
    unsolicited: true,
  });
}

export function getPendingUnsolicitedOffer(
  career: ManagerCareer
): InboxMessage | undefined {
  return career.inboxMessages.find(
    (m) =>
      !m.resolved &&
      m.unsolicited &&
      m.playerId &&
      m.offerAmount != null &&
      m.offerClub
  );
}

export function acceptIncomingOffer(
  career: ManagerCareer,
  messageId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  if (!msg || msg.resolved || !msg.playerId || !msg.offerAmount) {
    return { ok: false, error: "Offer not found" };
  }

  const playerId = msg.playerId;
  if (!career.squad.some((p) => p.playerId === playerId)) {
    return { ok: false, error: "Player is no longer at your club" };
  }
  const soldContract = career.contracts[playerId];
  if (!soldContract) {
    return { ok: false, error: "Player contract not found" };
  }
  const purchaseFee = soldContract.purchaseFee;

  const xiii = career.matchdayXiii.map((id) => (id === playerId ? "" : id));
  const interchange = career.matchdayInterchange.map((id) =>
    id === playerId ? "" : id
  );
  const nextContracts = { ...career.contracts };
  delete nextContracts[playerId];
  const nextTransfer = { ...career.playerTransferStatus };
  delete nextTransfer[playerId];
  const nextListed = career.leagueListedPlayers.filter(
    (row) => row.playerId !== playerId
  );

  const buyer = msg.offerClub ?? "Unknown";
  const buyerFunds = career.clubFunds[buyer] ?? 0;
  if (buyerFunds < msg.offerAmount) {
    return {
      ok: false,
      error: `${buyer} can no longer afford this transfer.`,
    };
  }

  const clubFunds = { ...career.clubFunds };
  clubFunds[buyer] = buyerFunds - msg.offerAmount;

  const nextMessages = career.inboxMessages.map((m) =>
    m.id === messageId ? { ...m, resolved: true, read: true } : m
  );

  let nextCareer: ManagerCareer = {
    ...career,
    clubFunds,
    squad: career.squad.filter((p) => p.playerId !== playerId),
    contracts: nextContracts,
    wageBill: computeCareerWageBill({
      ...career,
      contracts: nextContracts,
    } as ManagerCareer),
    matchdayXiii: xiii,
    matchdayInterchange: interchange,
    playerTransferStatus: nextTransfer,
    leagueListedPlayers: nextListed,
    inboxMessages: nextMessages,
    updatedAt: new Date().toISOString(),
  };

  nextCareer = addTransferIncome(nextCareer, msg.offerAmount);
  nextCareer = transferLeaguePlayer(nextCareer, playerId, career.club, buyer);
  const saleMsg = createPlayerSaleMessage(
    nextCareer,
    msg.playerName ?? getPlayerById(playerId)?.name ?? "Player",
    buyer,
    msg.offerAmount,
    playerId,
    purchaseFee
  );
  nextCareer = pushInboxMessage(nextCareer, saleMsg);
  nextCareer = syncManagerFinance(nextCareer);

  return {
    ok: true,
    career: nextCareer,
  };
}

export function rejectIncomingOffer(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true } : m
    ),
  };
}

/** Counter a transfer offer — buyer may raise their bid or walk away. */
export function negotiateIncomingOffer(
  career: ManagerCareer,
  messageId: string,
  counterAmount: number
): { ok: boolean; career?: ManagerCareer; feedback: string } {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  if (!msg || msg.resolved || (msg.type !== "transfer" && msg.type !== "transfer_offer_in")) {
    return { ok: false, feedback: "Offer not found." };
  }
  if (!msg.offerAmount || !msg.askingPrice) {
    return { ok: false, feedback: "Offer details missing." };
  }

  const current = msg.offerAmount;
  const asking = msg.askingPrice;

  if (counterAmount <= current) {
    return {
      ok: false,
      feedback: `Counter must exceed the current offer (${formatWage(current)}).`,
    };
  }
  if (counterAmount > asking * 1.15) {
    return {
      ok: false,
      feedback: "That price is above what any club will pay right now.",
    };
  }

  const rng = seedrandom(
    `${career.seed}-nego-${messageId}-${counterAmount}-${career.gameWeek}`
  );
  const ratio = counterAmount / asking;
  let acceptChance = 0.15;
  if (ratio >= 0.98) acceptChance = 0.75;
  else if (ratio >= 0.92) acceptChance = 0.5;
  else if (ratio >= 0.85) acceptChance = 0.3;

  const buyer = msg.offerClub ?? "The club";

  if (rng() < acceptChance) {
    const newOffer = Math.min(asking, Math.round(counterAmount));
    const nextMessages = career.inboxMessages.map((m) =>
      m.id === messageId
        ? {
            ...m,
            offerAmount: newOffer,
            body: `${buyer} have agreed to raise their offer to ${formatWage(newOffer)} for ${msg.playerName ?? "the player"}. Asking price: ${formatWage(asking)}.`,
          }
        : m
    );
    return {
      ok: true,
      career: { ...career, inboxMessages: nextMessages },
      feedback: `${buyer} accepted your counter — new offer ${formatWage(newOffer)}.`,
    };
  }

  const bump = Math.round(
    current + (counterAmount - current) * (0.25 + rng() * 0.35)
  );
  if (bump <= current || rng() < 0.2) {
    const nextMessages = career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true } : m
    );
    return {
      ok: true,
      career: { ...career, inboxMessages: nextMessages },
      feedback: `${buyer} ended negotiations.`,
    };
  }

  const nextMessages = career.inboxMessages.map((m) =>
    m.id === messageId
      ? {
          ...m,
          offerAmount: bump,
          body: `${buyer} countered with ${formatWage(bump)} for ${msg.playerName ?? "the player"}. Your asking price: ${formatWage(asking)}.`,
        }
      : m
  );

  return {
    ok: true,
    career: { ...career, inboxMessages: nextMessages },
    feedback: `${buyer} countered at ${formatWage(bump)}.`,
  };
}

export function getAllLeaguePlayers(career: ManagerCareer): {
  playerId: string;
  club: string;
}[] {
  const assigned = new Set(getUserClubPlayerIds(career));
  const rows: { playerId: string; club: string }[] = [];
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    for (const id of getLeagueClubRosterIds(career, club)) {
      if (assigned.has(id)) continue;
      assigned.add(id);
      rows.push({ playerId: id, club });
    }
  }
  return rows;
}

export function suggestedAskingPrice(playerId: string): number {
  const player = getPlayerById(playerId);
  if (!player) return 50_000;
  return Math.round(player.value * 1.05);
}

export function suggestedWageOffer(
  career: ManagerCareer,
  playerId: string
): BuyOffer {
  const demand = getTransferDemand(career, playerId);
  return {
    transferFee: 0,
    wagePerYear: demand.wagePerYear,
    yearsRequested: demand.yearsRequested,
    squadRole: demand.squadRole,
  };
}
