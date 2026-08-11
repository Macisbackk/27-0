import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { CURRENT_PLAYABLE_CLUBS, isSameManagerClub, rivalTransferClubs } from "../clubs/super-league-display";
import { getManagerClubConfig } from "./club-config";
import type {
  InboxMessage,
  LeagueListedPlayer,
  ManagerCareer,
  PlayerTransferStatus,
  SquadRole,
  TransferListingType,
  TransferOfferCategory,
  TransferOfferDiagnostic,
} from "./types";
import {
  calculateWageForPlayer,
  computeWageBill,
  formatWage,
  generateInitialContract,
  inferSquadRole,
} from "./managerContracts";
import { getManagerClubTeamRating } from "./managerRating";
import { dispatchAchievementCheck } from "../achievements/achievementNotify";
import { getManagerModePlayerRating } from "./managerSquadRatings";
import {
  buildLeaguePlayerClubMap,
  findPlayerLeagueClub,
  getLeagueClubRosterIds,
  getTrackedLeagueClubsForTransferMarket,
  getUserClubPlayerIds,
  pruneLeagueListedPlayers,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";
import { getPlayerSigningDemand } from "./managerTransfers";
import { createInitialPlayerState } from "./managerSquad";
import { addPlayersToFreeAgents, completeFreeAgentSigning, isFreeAgent } from "./managerFreeAgents";
import { syncManagerFinance, deductTransferFee, addTransferIncome, getTransferBudget, canAffordAdditionalWage, evaluateClubSigningAppeal, getBuyerAdjustedTransferFee, getManagerPlayerListingRating, computeFirstSeasonTransferBudget } from "./managerFinance";
import { getCareerClubStars } from "./managerDifficulty";
import { computeCareerWageBill } from "./managerReserveContracts";
import {
  canUserLoanOutPlayers,
  completeOutgoingLoan,
  getActiveLoan,
  getLoanOutDestinationClubs,
  isPlayerAwayOnLoan,
  isPlayerLoanedIn,
} from "./managerLoans";
import { resolveClubCompetitionForCareer, getUserCompetitionId } from "./leagueMembership";
import {
  createPlayerSaleMessage,
  createPlayerPurchaseMessage,
  pushInboxMessage,
  normalizeInboxMessage,
} from "./managerInbox";
import { addBoardTransferMilestoneInbox } from "./managerBoardInbox";
import { getLeagueSeasonIndex } from "./managerLeagueSeason";
import { DEFAULT_TRANSFER_ACTIVITY_CONFIG } from "./transferActivityConfig";
import { pruneTransferWatchlist } from "./managerWatchlist";
import {
  appendCanonicalTransferActivity,
  buildTransferActivity,
  clearAllMarketPresenceForPlayer,
  markTransferTxProcessed,
  wasTransferTxProcessed,
  syncUserListingToLeagueMarket,
  removePlayerFromLeagueMarket,
} from "./transferLedger";
import { rememberPlayerDeparture } from "./managerWorldStory";

function canGenerateOfferFromClub(
  career: ManagerCareer,
  playerId: string,
  offerClub: string,
  asLoan: boolean
): boolean {
  const pending = career.inboxMessages.filter(
    (m) =>
      !m.resolved &&
      m.playerId === playerId &&
      m.offerClub != null &&
      isSameManagerClub(m.offerClub, offerClub) &&
      (m.type === "transfer" || m.type === "transfer_offer_in")
  );
  if (pending.some((m) => Boolean(m.loanOffer) === asLoan)) return false;
  if (pending.some((m) => Boolean(m.loanOffer) !== asLoan)) return false;
  return true;
}

const TRANSFER_DIAGNOSTIC_CAP = 40;

export function resolveTransferListingType(
  listingType?: TransferListingType | null
): TransferListingType {
  return listingType ?? "permanent";
}

export function listingAllowsLoan(
  listingType?: TransferListingType | null
): boolean {
  const t = resolveTransferListingType(listingType);
  return t === "loan" || t === "both";
}

export function listingAllowsPermanent(
  listingType?: TransferListingType | null
): boolean {
  const t = resolveTransferListingType(listingType);
  return t === "permanent" || t === "both";
}

const LOAN_MARKET_YOUNG_MAX_AGE = 23;
/** Rating gap below the club's best that counts as surplus to requirements. */
const LOAN_MARKET_SURPLUS_GAP = 4;

function isLoanMarketCandidate(
  career: ManagerCareer,
  playerId: string,
  clubBestRating: number,
  rating: number
): boolean {
  const age = getManagerPlayerAge(career, playerId);
  const young = age != null && age <= LOAN_MARKET_YOUNG_MAX_AGE;
  const surplus = clubBestRating - rating >= LOAN_MARKET_SURPLUS_GAP;
  return young || surplus;
}

function pickAiListingType(
  rng: () => number,
  loanCandidate: boolean
): TransferListingType {
  const roll = rng();
  if (loanCandidate) {
    // Young / fringe players: mostly loan market, sometimes dual-listed.
    if (roll < 0.62) return "loan";
    if (roll < 0.88) return "both";
    return "permanent";
  }
  // Non-candidates are never loan-listed.
  return "permanent";
}

export function getTransferOfferGenerationPhase(
  gameWeek: number
): TransferOfferDiagnostic["generationPhase"] {
  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG;
  if (gameWeek <= cfg.transferTargetPool.earlySeasonThroughWeek) {
    return "early-season";
  }
  const heat = cfg.gameWeekActivityMultiplier(gameWeek);
  if (heat >= 1.2) return "window";
  if (heat <= 0.6) return "expiry";
  return "normal";
}

export function recordTransferOfferDiagnostic(
  career: ManagerCareer,
  diagnostic: TransferOfferDiagnostic
): ManagerCareer {
  if (process.env.NODE_ENV === "development") {
    console.debug("[transfer-offer]", diagnostic);
  }
  const recent = [
    ...(career.transferOfferDiagnostics ?? []),
    diagnostic,
  ].slice(-TRANSFER_DIAGNOSTIC_CAP);
  return { ...career, transferOfferDiagnostics: recent };
}

/** Senior season budget excludes Championship / reserve wire — never count reserveOffer. */
export function isSeniorSeasonApproachMessage(message: InboxMessage): boolean {
  if (message.reserveOffer) return false;
  if (message.offerCategory === "reserve") return false;
  return Boolean(message.unsolicited);
}

function isSeniorFirstTeamPlayer(
  career: ManagerCareer,
  playerId: string,
  seasonAppearances: number
): boolean {
  return (
    career.matchdayXiii.includes(playerId) ||
    career.matchdayInterchange.includes(playerId) ||
    seasonAppearances >= Math.max(3, career.gameWeek * 0.55)
  );
}

/**
 * Backfill offerCategory on pending inbox transfer bids (save migration).
 */
export function migrateTransferOfferCategories(
  career: ManagerCareer
): ManagerCareer {
  if ((career.transferOfferCategoryVersion ?? 0) >= 2) return career;

  const reserveIds = new Set((career.reserves ?? []).map((r) => r.id));
  const squadById = new Map(career.squad.map((p) => [p.playerId, p]));

  const inboxMessages = career.inboxMessages.map((message) => {
    if (message.offerCategory) return message;
    if (
      message.resolved ||
      !message.playerId ||
      message.offerAmount == null ||
      !message.offerClub
    ) {
      return message;
    }
    if (
      message.type !== "transfer" &&
      message.type !== "transfer_offer_in"
    ) {
      return message;
    }

    let offerCategory: TransferOfferCategory;
    if (message.reserveOffer || reserveIds.has(message.playerId)) {
      offerCategory = "reserve";
    } else {
      const ps = squadById.get(message.playerId);
      if (
        ps &&
        isSeniorFirstTeamPlayer(career, message.playerId, ps.seasonAppearances)
      ) {
        offerCategory = "senior-first-team";
      } else if (message.unsolicited) {
        offerCategory = "senior-rotation";
      } else {
        offerCategory = "senior-listed";
      }
    }

    return {
      ...message,
      offerCategory,
      reserveOffer: offerCategory === "reserve" ? true : message.reserveOffer,
    };
  });

  return {
    ...career,
    inboxMessages,
    transferOfferCategoryVersion: 2,
  };
}

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

export function initClubFunds(userClub: string, seed = "init"): Record<string, number> {
  const funds: Record<string, number> = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    funds[club] = computeFirstSeasonTransferBudget(club, `${seed}-ai`);
  }
  funds[userClub] = computeFirstSeasonTransferBudget(userClub, seed);
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
    player.peakRating
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
  rng: () => number,
  preferLoanCandidates = false,
  career?: ManagerCareer
): string | null {
  if (pool.length === 0) return null;
  const clubBest = Math.max(...pool.map((row) => row.rating));
  const weighted = pool.map((row) => {
    const belowBest = Math.max(0, clubBest - row.rating);
    // Fringe players list often; near-best squad members only occasionally.
    let weight = Math.pow(belowBest + 2, 1.55);
    if (
      preferLoanCandidates &&
      career &&
      isLoanMarketCandidate(career, row.id, clubBest, row.rating)
    ) {
      weight *= 3.2;
    }
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
  const seasonIndex = getLeagueSeasonIndex(career);
  // Season one: 1–3 listings per club. Later seasons run a busier market.
  const maxListPerClub =
    seasonIndex <= 0 ? 3 : Math.min(5, 3 + Math.floor(seasonIndex / 2));
  const minListPerClub = seasonIndex <= 0 ? 1 : 2;

  for (const club of getTrackedLeagueClubsForTransferMarket(career)) {
    if (isSameManagerClub(club, career.club)) continue;

    const pool = getListableClubPlayers(career, club);
    if (pool.length === 0) continue;

    const clubBest = Math.max(...pool.map((row) => row.rating));
    // Only Super League clubs can be loan parents.
    const clubCanListLoans =
      resolveClubCompetitionForCareer(club, career) === "super-league";
    const loanPool = clubCanListLoans
      ? pool.filter((row) =>
          isLoanMarketCandidate(career, row.id, clubBest, row.rating)
        )
      : [];

    const listCount = Math.min(
      pool.length,
      minListPerClub + Math.floor(rng() * (maxListPerClub - minListPerClub + 1))
    );
    const remaining = [...pool];
    let loanSlots =
      loanPool.length === 0
        ? 0
        : Math.min(
            loanPool.length,
            1 + (listCount >= 3 && rng() < 0.55 ? 1 : 0)
          );

    for (let i = 0; i < listCount; i++) {
      const preferLoan = clubCanListLoans && loanSlots > 0;
      const playerId = pickWeightedListablePlayer(
        remaining,
        rng,
        preferLoan,
        career
      );
      if (!playerId) break;

      const player = getManagerPlayer(career, playerId);
      if (!player) continue;

      const rating =
        remaining.find((row) => row.id === playerId)?.rating ??
        getPlayerListingRating(career, playerId);
      const loanCandidate =
        clubCanListLoans &&
        isLoanMarketCandidate(career, playerId, clubBest, rating);
      const listingType = !clubCanListLoans || !loanCandidate
        ? "permanent"
        : preferLoan
          ? rng() < 0.72
            ? "loan"
            : "both"
          : pickAiListingType(rng, loanCandidate);
      if (listingAllowsLoan(listingType) && loanCandidate) {
        loanSlots = Math.max(0, loanSlots - 1);
      }

      const mult = 0.8 + rng() * 0.4;
      listed.push({
        playerId,
        club,
        askingPrice:
          listingType === "loan"
            ? 0
            : Math.round(player.value * mult),
        listedAtWeek: gameWeek,
        listingType,
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
  round: number,
  career?: ManagerCareer
): number {
  const player = career
    ? getManagerPlayer(career, playerId) ?? getPlayerById(playerId)
    : getPlayerById(playerId);
  if (!player) return 0;
  const rng = seedrandom(`${seed}-price-${playerId}-r${round}`);
  if (listed) {
    return Math.round(player.value * (0.8 + rng() * 0.4));
  }
  // Unlisted premium — modest hold-out above value, not 1.5–2.5×.
  return Math.round(player.value * (1.12 + rng() * 0.28));
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
    return getAskingPrice(
      playerId,
      listed,
      career.seed,
      career.gameWeek,
      career
    );
  }
  return getAskingPrice(
    playerId,
    listed,
    career.seed,
    career.gameWeek,
    career
  );
}

/** Minimum fee the user's club must pay — seller asking price plus buyer-tier premium. */
export function getBuyerMinimumTransferFee(
  career: ManagerCareer,
  playerId: string,
  club: string,
  listed: boolean
): number {
  const asking = getSellerAskingPrice(career, playerId, club, listed);
  const rating = getManagerPlayerListingRating(career, playerId);
  const adjusted = getBuyerAdjustedTransferFee(
    career.club,
    asking,
    rating,
    getCareerClubStars(career),
    getUserCompetitionId(career)
  );
  return listed ? adjusted : Math.round(adjusted * 1.04);
}

export function listPlayerForTransfer(
  career: ManagerCareer,
  playerId: string,
  askingPrice: number,
  listingType: TransferListingType = "permanent"
): ManagerCareer {
  if (isPlayerAwayOnLoan(career, playerId) || isPlayerLoanedIn(career, playerId)) {
    return career;
  }
  if (listingAllowsLoan(listingType) && !canUserLoanOutPlayers(career)) {
    listingType = "permanent";
  }
  const player = getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
  if (!player) return career;

  const status: PlayerTransferStatus = {
    listed: true,
    askingPrice,
    listedAtGameWeek: career.gameWeek,
    listingType,
    transferRequested: career.playerTransferStatus[playerId]?.transferRequested,
  };

  return syncUserListingToLeagueMarket(
    {
      ...career,
      playerTransferStatus: {
        ...career.playerTransferStatus,
        [playerId]: status,
      },
      updatedAt: new Date().toISOString(),
    },
    playerId
  );
}

/** List a squad player on the loan market (Championship AI clubs can take them). */
export function listPlayerForLoan(
  career: ManagerCareer,
  playerId: string,
  askingPrice: number
): ManagerCareer {
  if (!canUserLoanOutPlayers(career)) return career;
  return listPlayerForTransfer(career, playerId, askingPrice, "loan");
}

/** List player and roll for an immediate incoming offer. */
export function listPlayerForTransferWithOffers(
  career: ManagerCareer,
  playerId: string,
  askingPrice: number,
  listingType: TransferListingType = "permanent"
): ManagerCareer {
  if (listingAllowsLoan(listingType) && !canUserLoanOutPlayers(career)) {
    listingType = "permanent";
  }
  let next = listPlayerForTransfer(career, playerId, askingPrice, listingType);
  if (listingAllowsPermanent(listingType)) {
    next = generateIncomingTransferOffers(next);
  }
  if (listingAllowsLoan(listingType)) {
    next = generateIncomingLoanOffers(next);
  }
  return next;
}

export function listPlayerForLoanWithOffers(
  career: ManagerCareer,
  playerId: string,
  askingPrice: number
): ManagerCareer {
  if (!canUserLoanOutPlayers(career)) return career;
  return listPlayerForTransferWithOffers(career, playerId, askingPrice, "loan");
}

export function unlistPlayerFromTransfer(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const prev = career.playerTransferStatus[playerId];
  const next = { ...career.playerTransferStatus };
  if (prev?.transferRequested) {
    next[playerId] = {
      listed: false,
      askingPrice: 0,
      listedAtGameWeek: career.gameWeek,
      transferRequested: true,
    };
  } else {
    delete next[playerId];
  }
  return removePlayerFromLeagueMarket(
    { ...career, playerTransferStatus: next },
    playerId,
    career.club
  );
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
  if (isPlayerAwayOnLoan(career, playerId)) {
    return {
      ok: false,
      error: "Cannot release a player who is away on loan. Recall them first.",
    };
  }
  if (isPlayerLoanedIn(career, playerId)) {
    return {
      ok: false,
      error: "Cannot release a loaned-in player. Their loan will end at season end.",
    };
  }
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
  if (sellerClub && isSameManagerClub(sellerClub, career.club)) {
    return {
      accepted: false,
      reason: "You cannot buy players from your own club.",
    };
  }
  if (!isFreeAgent(career, playerId) && sellerClub !== club) {
    return { accepted: false, reason: "Player is no longer at that club." };
  }

  if (getActiveLoan(career, playerId)) {
    return {
      accepted: false,
      reason: "Player is currently on loan and cannot be signed permanently.",
    };
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

  const minFee = getBuyerMinimumTransferFee(career, playerId, club, listed);
  let feeAcceptedSoftly = false;

  const rating = getManagerPlayerListingRating(career, playerId);
  const appeal = evaluateClubSigningAppeal(
    career.club,
    rating,
    getCareerClubStars(career),
    getUserCompetitionId(career)
  );
  if (!appeal.allowed) {
    return { accepted: false, reason: appeal.reason ?? "Signing blocked." };
  }

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

  const signing = getPlayerSigningDemand(career, playerId);
  if (offer.wagePerYear < signing.minAcceptableWage) {
    return { accepted: false, reason: "Wage offer too low." };
  }
  if (offer.yearsRequested < signing.yearsRequested && rating >= 84) {
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

  // Permanent buys must not leave a stale active loan (or buy your own loaned-out player).
  if (getActiveLoan(career, playerId)) {
    return career;
  }

  const sellerClub = findPlayerLeagueClub(career, playerId);
  if (!isFreeAgent(career, playerId) && sellerClub !== club) {
    return career;
  }

  const rep = getManagerClubTeamRating(career.club);
  const demand = getPlayerSigningDemand(career, playerId);
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
  const withMail = pruneTransferWatchlist(
    pruneLeagueListedPlayers(
      addBoardTransferMilestoneInbox(
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
        ),
        "signing",
        player?.name ?? "Player",
        offer.transferFee,
        playerId
      )
    ),
    [playerId]
  );

  const txId = `perm-buy-${playerId}-w${career.gameWeek}-${offer.transferFee}`;
  if (wasTransferTxProcessed(withMail, txId)) return withMail;
  let next = clearAllMarketPresenceForPlayer(withMail, playerId);
  next = appendCanonicalTransferActivity(
    next,
    buildTransferActivity({
      id: `hist-${txId}`,
      career: next,
      playerId,
      playerName: player?.name ?? "Player",
      fromClub: club,
      toClub: career.club,
      fee: offer.transferFee,
      transferType: "permanent",
      sourceSquad: "senior",
    })
  );
  return markTransferTxProcessed(next, txId);
}

export function generateIncomingTransferOffers(
  career: ManagerCareer
): ManagerCareer {
  const rng = seedrandom(`${career.seed}-offers-w${career.gameWeek}`);
  const messages = [...career.inboxMessages];
  const diagnostics: TransferOfferDiagnostic[] = [];
  const clubFunds = { ...career.clubFunds };
  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG.incomingOffers;
  const heat = DEFAULT_TRANSFER_ACTIVITY_CONFIG.gameWeekActivityMultiplier(
    career.gameWeek
  );
  const seasonBoost = getLeagueSeasonIndex(career) >= 1 ? cfg.seasonBoost : 0;
  const phase = getTransferOfferGenerationPhase(career.gameWeek);

  const pendingTransferMail = messages.filter(
    (m) =>
      !m.resolved && (m.type === "transfer" || m.type === "transfer_offer_in")
  ).length;
  if (pendingTransferMail >= 5) {
    return career;
  }

  for (const [playerId, status] of Object.entries(career.playerTransferStatus)) {
    if (!status.listed) continue;
    // Loan-only listings get Championship loan approaches, not permanent sales.
    if (!listingAllowsPermanent(status.listingType)) continue;
    // Parent club owns loaned-out players; loaned-in players are not yours to sell.
    if (isPlayerAwayOnLoan(career, playerId) || isPlayerLoanedIn(career, playerId)) {
      continue;
    }
    if (messages.some((m) => !m.resolved && m.playerId === playerId)) continue;
    if (
      messages.filter(
        (m) =>
          !m.resolved &&
          (m.type === "transfer" || m.type === "transfer_offer_in")
      ).length >= 5
    ) {
      break;
    }

    const player = getPlayerById(playerId);
    if (!player) continue;

    const rating = player.peakRating;
    const priceRatio = status.askingPrice / Math.max(1, player.value);
    let chance = Math.min(0.7, (cfg.baseChance + seasonBoost) * heat);
    if (priceRatio <= 1.1) chance += 0.2;
    if (priceRatio > 1.5) chance -= 0.1;
    if (rating >= 84) chance += 0.1;
    if (rating < 82) chance -= 0.05;

    if (rng() > chance) continue;

    const buyers = rivalTransferClubs(career.club);
    if (buyers.length === 0) continue;
    const storyChains = career.worldStory?.chains ?? [];
    const interest = storyChains.find(
      (c) =>
        c.kind === "transfer_interest" &&
        c.playerId === playerId &&
        c.clubId &&
        c.stage >= 1
    );
    const buyer =
      interest?.clubId && buyers.includes(interest.clubId)
        ? interest.clubId
        : buyers[Math.floor(rng() * buyers.length)]!;
    if (isSameManagerClub(buyer, career.club)) continue;
    if (!canGenerateOfferFromClub(career, playerId, buyer, false)) continue;
    const funds = clubFunds[buyer] ?? getManagerClubConfig(buyer).budget;
    const offerAmount = Math.round(
      status.askingPrice * (0.75 + rng() * 0.2)
    );

    if (offerAmount > funds * 0.4) continue;

    const ps = career.squad.find((p) => p.playerId === playerId);
    const offerCategory: TransferOfferCategory =
      ps &&
      isSeniorFirstTeamPlayer(career, playerId, ps.seasonAppearances)
        ? "senior-first-team"
        : "senior-listed";
    const requestId = `offer-${playerId}-${career.gameWeek}-${Math.floor(rng() * 10000)}`;

    messages.unshift({
      id: requestId,
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
      offerCategory,
    });

    diagnostics.push({
      requestId,
      targetPlayerId: playerId,
      targetSquad: "senior",
      targetRole: offerCategory,
      buyingClubId: buyer,
      generatedWeek: career.gameWeek,
      generationPhase: phase,
      countedAgainstCategory: "listed-incoming",
    });
  }

  let next: ManagerCareer = { ...career, inboxMessages: messages };
  for (const diagnostic of diagnostics) {
    next = recordTransferOfferDiagnostic(next, diagnostic);
  }
  return next;
}

/**
 * Championship AI clubs approach Super League players listed for loan.
 * Accepting completes an outgoing season loan (not a permanent sale).
 */
export function generateIncomingLoanOffers(
  career: ManagerCareer
): ManagerCareer {
  if (!canUserLoanOutPlayers(career)) return career;

  const rng = seedrandom(`${career.seed}-loan-offers-w${career.gameWeek}`);
  const messages = [...career.inboxMessages];
  const destinations = getLoanOutDestinationClubs(career);
  if (destinations.length === 0) return career;

  const pendingTransferMail = messages.filter(
    (m) =>
      !m.resolved && (m.type === "transfer" || m.type === "transfer_offer_in")
  ).length;
  if (pendingTransferMail >= 5) return career;

  for (const [playerId, status] of Object.entries(career.playerTransferStatus)) {
    if (!status.listed || !listingAllowsLoan(status.listingType)) continue;
    if (isPlayerAwayOnLoan(career, playerId) || isPlayerLoanedIn(career, playerId)) {
      continue;
    }
    if (messages.some((m) => !m.resolved && m.playerId === playerId)) continue;
    if (
      messages.filter(
        (m) =>
          !m.resolved &&
          (m.type === "transfer" || m.type === "transfer_offer_in")
      ).length >= 5
    ) {
      break;
    }

    const player = getPlayerById(playerId);
    if (!player) continue;
    if (!career.squad.some((p) => p.playerId === playerId)) continue;

    // Loan interest is more common than permanent bids — listing is already a signal.
    let chance = 0.55;
    if (player.peakRating >= 84) chance -= 0.12;
    if (player.peakRating < 78) chance += 0.1;
    if (rng() > chance) continue;

    const loanee = destinations[Math.floor(rng() * destinations.length)]!;
    if (isSameManagerClub(loanee, career.club)) continue;
    if (!canGenerateOfferFromClub(career, playerId, loanee, true)) continue;

    // Parent keeps 40–60% of wages on AI approaches.
    const parentWageShare = Math.round((0.4 + rng() * 0.2) * 20) / 20;
    const parentPct = Math.round(parentWageShare * 100);
    const requestId = `loan-offer-${playerId}-${career.gameWeek}-${Math.floor(rng() * 10000)}`;

    messages.unshift({
      id: requestId,
      type: "transfer",
      title: "Loan Offer",
      body: `${loanee} want ${player.name} on loan until the end of the season. You would keep paying ${parentPct}% of wages. No loan fee.`,
      week: career.gameWeek,
      season: career.seasonYear,
      gameWeek: career.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      resolved: false,
      playerId,
      playerName: player.name,
      offerClub: loanee,
      offerAmount: 0,
      askingPrice: 0,
      loanOffer: true,
      loanParentWageShare: parentWageShare,
      offerCategory: "senior-listed",
    });
  }

  return { ...career, inboxMessages: messages };
}

const SENIOR_APPROACH_SEASON_WEEKS = 27;

export function getSeniorApproachSeasonTarget(career: ManagerCareer): number {
  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG.transferTargetPool;
  const rng = seedrandom(
    `${career.seed}-senior-approach-target-s${career.seasonYear}`
  );
  return (
    cfg.minSeniorApproachesPerSeason +
    Math.floor(
      rng() *
        (cfg.maxSeniorApproachesPerSeason -
          cfg.minSeniorApproachesPerSeason +
          1)
    )
  );
}

/**
 * Chance needed this week to exhaust a fixed season budget, with opening
 * weeks weighted more heavily. The final eligible week consumes any remainder.
 */
export function getSeniorApproachWeeklyChance(
  gameWeek: number,
  approachesSoFar: number,
  seasonTarget: number
): number {
  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG.transferTargetPool;
  const remaining = Math.max(0, seasonTarget - approachesSoFar);
  if (remaining === 0 || gameWeek < 1 || gameWeek > SENIOR_APPROACH_SEASON_WEEKS) {
    return 0;
  }
  const weeksRemaining = SENIOR_APPROACH_SEASON_WEEKS - gameWeek + 1;
  if (remaining >= weeksRemaining) return 1;

  let remainingWeight = 0;
  for (let week = gameWeek; week <= SENIOR_APPROACH_SEASON_WEEKS; week++) {
    remainingWeight +=
      week <= cfg.earlySeasonThroughWeek ? cfg.earlySeasonMultiplier : 1;
  }
  const currentWeight =
    gameWeek <= cfg.earlySeasonThroughWeek ? cfg.earlySeasonMultiplier : 1;
  return Math.min(1, (remaining * currentWeight) / remainingWeight);
}

/** Season-budgeted post-match approaches for unlisted senior squad players. */
export function generateUnsolicitedTransferOffers(
  career: ManagerCareer
): ManagerCareer {
  const rng = seedrandom(`${career.seed}-unsolicited-w${career.gameWeek}`);
  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG.transferTargetPool;
  const seasonOffers = career.inboxMessages.filter(
    (message) =>
      isSeniorSeasonApproachMessage(message) &&
      message.season === career.seasonYear
  );
  const offersThisWeek = seasonOffers.filter(
    (message) => message.gameWeek === career.gameWeek
  ).length;
  if (offersThisWeek >= cfg.maxSeniorApproachesPerWeek) return career;

  const pendingCount = career.inboxMessages.filter(
    (message) =>
      !message.resolved && isSeniorSeasonApproachMessage(message)
  ).length;
  if (pendingCount >= cfg.maxPendingSeniorApproaches) {
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
      // Clubs cannot buy a player you only have on loan.
      if (isPlayerLoanedIn(career, ps.playerId)) return null;
      if (ps.injury) return null;
      if ((career.transferTargetCooldowns?.[ps.playerId] ?? 0) > career.gameWeek) {
        return null;
      }

      const player = getPlayerById(ps.playerId);
      if (!player) return null;

      const rating = player.peakRating;
      const formBoost = Math.max(0, ps.form - 50) / 45;
      const triesBoost = Math.min(ps.seasonTries * 0.18, 0.55);
      const appsBoost = ps.seasonAppearances >= 3 ? 0.12 : 0;
      const ratingBoost =
        rating >= 90 ? 0.3 : rating >= 86 ? 0.18 : rating >= 83 ? 0.08 : 0;
      const isFirstTeam = isSeniorFirstTeamPlayer(
        career,
        ps.playerId,
        ps.seasonAppearances
      );
      const poolWeight = isFirstTeam
        ? cfg.weights.seniorFirstTeam
        : cfg.weights.seniorRotation;
      const weight =
        (0.35 + formBoost + triesBoost + appsBoost + ratingBoost) * poolWeight;

      return { ps, player, weight, isFirstTeam };
    })
    .filter(
      (
        row
      ): row is {
        ps: (typeof career.squad)[number];
        player: NonNullable<ReturnType<typeof getPlayerById>>;
        weight: number;
        isFirstTeam: boolean;
      } => row !== null
    );

  if (candidates.length === 0) return career;

  const buyers = rivalTransferClubs(career.club).filter(
    (club) =>
      (career.transferTargetClubCooldowns?.[club] ?? 0) <= career.gameWeek
  );
  if (buyers.length === 0) return career;

  const target = getSeniorApproachSeasonTarget(career);
  const approachChance = getSeniorApproachWeeklyChance(
    career.gameWeek,
    seasonOffers.length,
    target
  );
  if (rng() > approachChance) return career;

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

  const { ps, player, isFirstTeam } = picked;
  const offerCategory: TransferOfferCategory = isFirstTeam
    ? "senior-first-team"
    : "senior-rotation";
  const impliedPrice = getAskingPrice(
    ps.playerId,
    false,
    career.seed,
    career.gameWeek,
    career
  );

  // Prefer a buyer that can afford the approach so a successful week roll
  // is not wasted on an underfunded club.
  const affordableBuyers = buyers.filter((club) => {
    if (isSameManagerClub(club, career.club)) return false;
    const funds = career.clubFunds[club] ?? getManagerClubConfig(club).budget;
    const offerAmount = Math.round(impliedPrice * 0.95);
    return offerAmount <= funds * 0.35;
  });
  const buyerPool = affordableBuyers.length > 0 ? affordableBuyers : buyers;
  const buyer = buyerPool[Math.floor(rng() * buyerPool.length)]!;
  if (isSameManagerClub(buyer, career.club)) return career;
  const funds = career.clubFunds[buyer] ?? getManagerClubConfig(buyer).budget;
  const offerAmount = Math.round(impliedPrice * (0.9 + rng() * 0.1));

  if (offerAmount > funds * 0.35) return career;

  const requestId = `unsolicited-${ps.playerId}-${career.gameWeek}-${Math.floor(rng() * 10000)}`;
  const withOffer = pushInboxMessage(career, {
    id: requestId,
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
    offerCategory,
  });
  const withDiag = recordTransferOfferDiagnostic(withOffer, {
    requestId,
    targetPlayerId: ps.playerId,
    targetSquad: "senior",
    targetRole: offerCategory,
    buyingClubId: buyer,
    generatedWeek: career.gameWeek,
    generationPhase: getTransferOfferGenerationPhase(career.gameWeek),
    countedAgainstCategory: "senior-unsolicited",
  });
  return {
    ...withDiag,
    transferTargetCooldowns: {
      ...(withDiag.transferTargetCooldowns ?? {}),
      [ps.playerId]: career.gameWeek + cfg.playerCooldownWeeks,
    },
    transferTargetClubCooldowns: {
      ...(withDiag.transferTargetClubCooldowns ?? {}),
      [buyer]: career.gameWeek + cfg.clubCooldownWeeks,
    },
    transferTargetBalanceVersion: 4,
  };
}

/**
 * Any unresolved bid from another club for one of the user's players
 * (listed, unsolicited, or Championship → reserve).
 */
export function isIncomingClubBid(
  message: InboxMessage,
  career: ManagerCareer
): boolean {
  if (message.resolved) return false;
  if (!message.playerId || message.offerAmount == null || !message.offerClub) {
    return false;
  }
  if (isSameManagerClub(message.offerClub, career.club)) return false;
  if (message.reserveOffer) return true;
  if (message.unsolicited) return true;
  return (
    message.type === "transfer" ||
    message.type === "transfer_offer_in"
  );
}

export function getPendingIncomingClubBids(
  career: ManagerCareer
): InboxMessage[] {
  return career.inboxMessages.filter((m) => isIncomingClubBid(m, career));
}

export function getPendingIncomingClubBid(
  career: ManagerCareer
): InboxMessage | undefined {
  return getPendingIncomingClubBids(career)[0];
}

/** @deprecated Prefer getPendingIncomingClubBid — now returns any incoming club bid. */
export function getPendingUnsolicitedOffer(
  career: ManagerCareer
): InboxMessage | undefined {
  return getPendingIncomingClubBid(career);
}

export function acceptIncomingOffer(
  career: ManagerCareer,
  messageId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  if (!msg || msg.resolved || !msg.playerId) {
    return { ok: false, error: "Offer not found" };
  }

  if (msg.loanOffer) {
    return acceptIncomingLoanOffer(career, messageId);
  }

  if (msg.offerAmount == null || msg.offerAmount < 0) {
    return { ok: false, error: "Offer not found" };
  }

  const playerId = msg.playerId;
  if (isPlayerAwayOnLoan(career, playerId)) {
    return {
      ok: false,
      error: "Cannot sell a player who is away on loan. Recall them first.",
    };
  }
  if (isPlayerLoanedIn(career, playerId)) {
    return {
      ok: false,
      error: "Cannot permanently sell a loaned-in player.",
    };
  }
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
  if (isSameManagerClub(buyer, career.club)) {
    return { ok: false, error: "Invalid offer — your club cannot buy from itself." };
  }
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
  nextCareer = rememberPlayerDeparture(nextCareer, playerId);
  const saleMsg = createPlayerSaleMessage(
    nextCareer,
    msg.playerName ?? getPlayerById(playerId)?.name ?? "Player",
    buyer,
    msg.offerAmount,
    playerId,
    purchaseFee
  );
  nextCareer = pushInboxMessage(nextCareer, saleMsg);
  nextCareer = addBoardTransferMilestoneInbox(
    nextCareer,
    "sale",
    msg.playerName ?? getPlayerById(playerId)?.name ?? "Player",
    msg.offerAmount,
    playerId
  );
  nextCareer = syncManagerFinance(nextCareer);

  dispatchAchievementCheck({ trigger: "player-sold", playerSold: true });

  const saleTxId = `perm-sale-${playerId}-${messageId}`;
  if (!wasTransferTxProcessed(nextCareer, saleTxId)) {
    nextCareer = clearAllMarketPresenceForPlayer(nextCareer, playerId);
    nextCareer = appendCanonicalTransferActivity(
      nextCareer,
      buildTransferActivity({
        id: `hist-${saleTxId}`,
        career: nextCareer,
        playerId,
        playerName: msg.playerName ?? getPlayerById(playerId)?.name ?? "Player",
        fromClub: career.club,
        toClub: buyer,
        fee: msg.offerAmount,
        transferType: "permanent",
        sourceSquad: "senior",
      })
    );
    nextCareer = markTransferTxProcessed(nextCareer, saleTxId);
  }

  return {
    ok: true,
    career: nextCareer,
  };
}

/** Accept a Championship loan approach for a loan-listed squad player. */
export function acceptIncomingLoanOffer(
  career: ManagerCareer,
  messageId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  if (!msg || msg.resolved || !msg.playerId || !msg.loanOffer || !msg.offerClub) {
    return { ok: false, error: "Offer not found" };
  }

  const playerId = msg.playerId;
  if (isPlayerAwayOnLoan(career, playerId) || getActiveLoan(career, playerId)) {
    return {
      ok: false,
      error: "Player is already on loan.",
    };
  }
  if (isPlayerLoanedIn(career, playerId)) {
    return {
      ok: false,
      error: "Cannot loan out a loaned-in player.",
    };
  }
  if (!career.squad.some((p) => p.playerId === playerId)) {
    return { ok: false, error: "Player is no longer at your club" };
  }

  const status = career.playerTransferStatus[playerId];
  if (!status?.listed || !listingAllowsLoan(status.listingType)) {
    return {
      ok: false,
      error: "Player is no longer listed for loan.",
    };
  }

  const parentWageShare =
    typeof msg.loanParentWageShare === "number"
      ? msg.loanParentWageShare
      : 0.5;

  let next = completeOutgoingLoan(career, playerId, msg.offerClub, {
    loanFee: Math.max(0, msg.offerAmount ?? 0),
    parentWageShare,
    canRecall: true,
  });

  if (getActiveLoan(next, playerId) == null) {
    return {
      ok: false,
      error: "Could not complete this loan.",
    };
  }

  next = {
    ...next,
    inboxMessages: next.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true, read: true } : m
    ),
  };

  return { ok: true, career: next };
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
  if (msg.playerId && isPlayerLoanedIn(career, msg.playerId)) {
    return {
      ok: false,
      feedback: "Cannot sell a loaned-in player.",
    };
  }
  if (msg.loanOffer) {
    return {
      ok: false,
      feedback: "Loan approaches cannot be renegotiated — accept or reject.",
    };
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
  for (const [playerId, club] of buildLeaguePlayerClubMap(career)) {
    rows.push({ playerId, club });
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
  const demand = getPlayerSigningDemand(career, playerId);
  return {
    transferFee: 0,
    wagePerYear: demand.wagePerYear,
    yearsRequested: demand.yearsRequested,
    squadRole: demand.squadRole,
  };
}
