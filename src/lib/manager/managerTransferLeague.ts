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
import {
  findPlayerLeagueClub,
  getLeagueClubRosterIds,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { createInitialPlayerState } from "./managerSquad";
import { getPlayerAge } from "../players/player-age";
import { getTransferDemand } from "./managerTransfers";
import { syncManagerFinance, deductTransferFee, addTransferIncome } from "./managerFinance";
import {
  createPlayerSaleMessage,
  createPlayerPurchaseMessage,
  pushInboxMessage,
  normalizeInboxMessage,
} from "./managerInbox";

export function initClubFunds(userClub: string): Record<string, number> {
  const funds: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    funds[club] = getManagerClubConfig(club).budget;
  }
  funds[userClub] = getManagerClubConfig(userClub).budget;
  return funds;
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
    const roster = getLeagueClubRosterIds(career, club);
    const listCount = 1 + Math.floor(rng() * 3);
    const shuffled = [...roster].sort(() => rng() - 0.5);

    for (let i = 0; i < listCount && i < shuffled.length; i++) {
      const playerId = shuffled[i]!;
      const player = getPlayerById(playerId);
      if (!player) continue;
      const mult = 0.8 + rng() * 0.4;
      listed.push({
        playerId,
        club,
        askingPrice: Math.round(player.value * mult),
        listedAtWeek: gameWeek,
      });
    }
  }

  return listed.sort((a, b) => {
    const ra = getPlayerById(a.playerId)?.peakRating ?? 0;
    const rb = getPlayerById(b.playerId)?.peakRating ?? 0;
    return rb - ra;
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
  if (career.budget < cost) {
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
  const nextTransfer = { ...career.playerTransferStatus };
  delete nextTransfer[playerId];

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

  return {
    ok: true,
    cost,
    career: {
      ...career,
      budget: career.budget - cost,
      squad: career.squad.filter((p) => p.playerId !== playerId),
      contracts: nextContracts,
      wageBill: computeWageBill(nextContracts),
      matchdayXiii: xiii,
      matchdayInterchange: interchange,
      playerTransferStatus: nextTransfer,
      inboxMessages: [msg, ...career.inboxMessages],
      updatedAt: new Date().toISOString(),
    },
  };
}

export interface BuyOffer {
  transferFee: number;
  wagePerYear: number;
  yearsRequested: number;
  squadRole: SquadRole;
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

  const asking = getAskingPrice(
    playerId,
    listed,
    career.seed,
    career.gameWeek
  );
  const minFee = listed ? asking * 0.85 : asking * 1.1;

  if (offer.transferFee < minFee) {
    return {
      accepted: false,
      reason: listed
        ? "Transfer fee too low."
        : "Club unwilling to sell — fee too low for an unlisted player.",
    };
  }
  if (career.budget < offer.transferFee) {
    return { accepted: false, reason: "Insufficient transfer budget." };
  }

  const demand = getTransferDemand(playerId, career.club);
  if (offer.wagePerYear < demand.wagePerYear * 0.9) {
    return { accepted: false, reason: "Wage offer too low." };
  }
  if (career.wageBill + offer.wagePerYear > career.wageBudget * 1.05) {
    return { accepted: false, reason: "Wage bill would exceed budget." };
  }
  if (career.squad.length >= 35) {
    return { accepted: false, reason: "Squad is full." };
  }

  return { accepted: true, reason: "Deal agreed." };
}

export function completePlayerPurchase(
  career: ManagerCareer,
  playerId: string,
  club: string,
  offer: BuyOffer,
  listed: boolean
): ManagerCareer {
  const rep = getManagerClubTeamRating(career.club);
  const contract = generateInitialContract(playerId, false, rep);
  contract.wagePerYear = offer.wagePerYear;
  contract.yearsRemaining = offer.yearsRequested;
  contract.squadRole = offer.squadRole;
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
          wageBill: computeWageBill(nextContracts),
          leagueListedPlayers: nextListed,
          transferMarket: nextListed.map((l) => l.playerId),
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
  return pushInboxMessage(
    purchased,
    createPlayerPurchaseMessage(
      purchased,
      playerId,
      player?.name ?? "Player",
      club,
      offer.transferFee,
      offer.wagePerYear
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

export function acceptIncomingOffer(
  career: ManagerCareer,
  messageId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  if (!msg || msg.resolved || !msg.playerId || !msg.offerAmount) {
    return { ok: false, error: "Offer not found" };
  }

  const playerId = msg.playerId;
  const xiii = career.matchdayXiii.map((id) => (id === playerId ? "" : id));
  const interchange = career.matchdayInterchange.map((id) =>
    id === playerId ? "" : id
  );
  const nextContracts = { ...career.contracts };
  delete nextContracts[playerId];
  const nextTransfer = { ...career.playerTransferStatus };
  delete nextTransfer[playerId];

  const clubFunds = { ...career.clubFunds };
  const buyer = msg.offerClub ?? "Unknown";
  clubFunds[buyer] = Math.max(0, (clubFunds[buyer] ?? 0) - msg.offerAmount);

  const nextMessages = career.inboxMessages.map((m) =>
    m.id === messageId ? { ...m, resolved: true, read: true } : m
  );

  let nextCareer: ManagerCareer = {
    ...career,
    clubFunds,
    squad: career.squad.filter((p) => p.playerId !== playerId),
    contracts: nextContracts,
    wageBill: computeWageBill(nextContracts),
    matchdayXiii: xiii,
    matchdayInterchange: interchange,
    playerTransferStatus: nextTransfer,
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
    playerId
  );
  nextCareer = pushInboxMessage(nextCareer, saleMsg);

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
  const rows: { playerId: string; club: string }[] = [];
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    for (const id of getLeagueClubRosterIds(career, club)) {
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

export function suggestedWageOffer(playerId: string, club: string): BuyOffer {
  const demand = getTransferDemand(playerId, club);
  return {
    transferFee: 0,
    wagePerYear: demand.wagePerYear,
    yearsRequested: demand.yearsRequested,
    squadRole: demand.squadRole,
  };
}
