import seedrandom from "seedrandom";
import type { Position } from "../types";
import {
  CHAMPIONSHIP_CLUBS,
  getChampionshipClubById,
  getChampionshipClubByName,
} from "../clubs/championship-clubs";
import type {
  InboxMessage,
  LeagueTransferActivity,
  ManagerCareer,
  ManagerReservePlayer,
} from "./types";
import {
  championshipTransferValue,
} from "./championship/championshipRatingScale";
import type { ChampionshipGeneratedPlayer } from "./championship/championshipSquads";
import { pushInboxMessage } from "./managerInbox";
import { addTransferIncome, syncManagerFinance } from "./managerFinance";
import { computeCareerWageBill } from "./managerReserveContracts";
import { formatWage } from "./managerContracts";
import { DEFAULT_TRANSFER_ACTIVITY_CONFIG } from "./transferActivityConfig";
import {
  getTransferOfferGenerationPhase,
  recordTransferOfferDiagnostic,
} from "./managerTransferLeague";

const MAX_TRANSFER_HISTORY = 40;

/** Soft roster caps mirroring the Super League Champ→SL need model. */
const CHAMP_POSITION_SOFT_CAPS: Partial<Record<Position, number>> = {
  PROP: 5,
  HOOKER: 3,
  WING: 4,
  SCRUM_HALF: 3,
  STAND_OFF: 3,
  CENTRE: 4,
  SECOND_ROW: 5,
  LOOSE_FORWARD: 3,
  FULLBACK: 3,
};

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function nationalityCodeForReserve(
  nationality: string
): ChampionshipGeneratedPlayer["nationalityCode"] {
  if (nationality === "France") return "FRA";
  if (nationality === "Australia") return "AUS";
  return "ENG";
}

function adaptReserveToChampionshipPlayer(
  reserve: ManagerReservePlayer,
  clubId: string,
  clubName: string
): ChampionshipGeneratedPlayer {
  return {
    id: reserve.id,
    name: reserve.name,
    clubId,
    clubName,
    position: reserve.position,
    eligiblePositions:
      reserve.eligiblePositions.length > 0
        ? reserve.eligiblePositions
        : [reserve.position],
    peakRating: reserve.rating,
    age: reserve.age,
    nationality: reserve.nationality,
    nationalityCode: nationalityCodeForReserve(reserve.nationality),
    form: reserve.form,
  };
}

interface ReserveCandidate {
  reserve: ManagerReservePlayer;
  /** Super League club that currently owns this reserve. */
  ownerClub: string;
  isUser: boolean;
}

function isEligibleReserve(
  career: ManagerCareer,
  reserve: ManagerReservePlayer,
  cfg: typeof DEFAULT_TRANSFER_ACTIVITY_CONFIG.reserveToChampionship
): boolean {
  if (reserve.rating < cfg.minCaRating || reserve.rating > cfg.maxCaRating) {
    return false;
  }
  if (reserve.age < 18 || reserve.age > 31) return false;
  if (reserve.markedForRelease) return false;
  const cooldownUntil = career.reserveToChampionshipCooldowns?.[reserve.id] ?? 0;
  if (cooldownUntil > career.gameWeek) return false;
  return true;
}

function collectReserveCandidates(
  career: ManagerCareer,
  cfg: typeof DEFAULT_TRANSFER_ACTIVITY_CONFIG.reserveToChampionship
): ReserveCandidate[] {
  const out: ReserveCandidate[] = [];
  for (const reserve of career.reserves ?? []) {
    if (isEligibleReserve(career, reserve, cfg)) {
      out.push({ reserve, ownerClub: career.club, isUser: true });
    }
  }

  // AI clubs only carry full reserve records once the user has managed them
  // (see managerClubChange.ts / managerReserves.ts) — most AI clubs only
  // track headcounts, so this pool is often empty and that's expected.
  for (const [club, reserves] of Object.entries(career.leagueClubReserves ?? {})) {
    if (club === career.club) continue;
    for (const reserve of reserves ?? []) {
      if (isEligibleReserve(career, reserve, cfg)) {
        out.push({ reserve, ownerClub: club, isUser: false });
      }
    }
  }

  const pendingIds = new Set(
    career.inboxMessages
      .filter((m) => !m.resolved && m.reserveOffer && m.playerId)
      .map((m) => m.playerId!)
  );
  return out.filter((c) => !pendingIds.has(c.reserve.id));
}

function championshipClubNeedsPosition(
  career: ManagerCareer,
  clubId: string,
  position: Position
): boolean {
  const squads = career.championshipSquads;
  if (!squads) return false;
  const ids = squads.rosterByClub[clubId] ?? [];
  let count = 0;
  for (const id of ids) {
    if (squads.players[id]?.position === position) count++;
  }
  return count < (CHAMP_POSITION_SOFT_CAPS[position] ?? 4);
}

function pickChampionshipClubNeed(
  career: ManagerCareer,
  clubId: string,
  rng: () => number
): Position | null {
  const needs = (Object.keys(CHAMP_POSITION_SOFT_CAPS) as Position[]).filter(
    (pos) => championshipClubNeedsPosition(career, clubId, pos)
  );
  if (needs.length === 0) return null;
  return needs[Math.floor(rng() * needs.length)] ?? null;
}

function candidateWeight(
  candidate: ReserveCandidate,
  need: Position | null
): number {
  const { reserve } = candidate;
  const matchesNeed =
    need == null ||
    reserve.position === need ||
    reserve.eligiblePositions.includes(need);
  if (!matchesNeed) return 0;

  let w = 1;
  if (need != null && reserve.position === need) w += 1.5;
  if (reserve.rating >= 78) w += 1;
  else if (reserve.rating >= 74) w += 0.5;
  if (reserve.potentialRating - reserve.rating >= 6) w += 0.5;
  if (reserve.form >= 60) w += 0.25;
  return Math.max(0.1, w);
}

function pickWeightedCandidate(
  pool: ReserveCandidate[],
  need: Position | null,
  rng: () => number
): ReserveCandidate | null {
  const weighted = pool
    .map((c) => ({ c, w: candidateWeight(c, need) }))
    .filter((row) => row.w > 0);
  if (weighted.length === 0) return null;
  const total = weighted.reduce((sum, row) => sum + row.w, 0);
  let roll = rng() * total;
  for (const row of weighted) {
    roll -= row.w;
    if (roll <= 0) return row.c;
  }
  return weighted[weighted.length - 1]!.c;
}

function computeReserveTransferFee(
  reserve: ManagerReservePlayer,
  rng: () => number
): number {
  const base = championshipTransferValue(reserve.rating);
  const upside = Math.max(0, reserve.potentialRating - reserve.rating) * 900;
  return Math.round(base * (0.7 + rng() * 0.5) + upside);
}

/** Insert a player into a Championship squad, releasing the weakest player if over the cap. */
function insertPlayerIntoChampionshipSquad(
  career: ManagerCareer,
  player: ChampionshipGeneratedPlayer
): ManagerCareer {
  const squads = career.championshipSquads;
  if (!squads) return career;

  const rosterByClub = { ...squads.rosterByClub };
  let players = { ...squads.players, [player.id]: player };

  // Defensive: strip the id from any other roster first (ids are unique in practice).
  for (const clubId of Object.keys(rosterByClub)) {
    if (clubId === player.clubId) continue;
    if (rosterByClub[clubId]?.includes(player.id)) {
      rosterByClub[clubId] = rosterByClub[clubId]!.filter(
        (id) => id !== player.id
      );
    }
  }

  const existingRoster = rosterByClub[player.clubId] ?? [];
  let roster = existingRoster.includes(player.id)
    ? existingRoster
    : [...existingRoster, player.id];

  const limit = DEFAULT_TRANSFER_ACTIVITY_CONFIG.reserveToChampionship.squadSizeLimit;
  if (roster.length > limit) {
    const ranked = roster
      .map((id) => players[id])
      .filter((p): p is ChampionshipGeneratedPlayer => Boolean(p))
      .sort((a, b) => a.peakRating - b.peakRating);
    // Never release the player we just signed — drop the next weakest instead.
    const weakest = ranked.find((p) => p.id !== player.id);
    if (weakest) {
      roster = roster.filter((id) => id !== weakest.id);
      const rest = { ...players };
      delete rest[weakest.id];
      players = rest;
    }
  }

  rosterByClub[player.clubId] = roster;

  return {
    ...career,
    championshipSquads: { ...squads, rosterByClub, players },
  };
}

interface CompleteTransferParams {
  reserve: ManagerReservePlayer;
  fromClub: string;
  isUserReserve: boolean;
  toClubId: string;
  fee: number;
  week: number;
}

/** Move a reserve out of a Super League reserve squad and into a Championship squad. */
function completeReserveToChampionshipTransfer(
  career: ManagerCareer,
  params: CompleteTransferParams
): ManagerCareer {
  const { reserve, fromClub, isUserReserve, toClubId, fee, week } = params;
  const champClub = getChampionshipClubById(toClubId);
  const champClubName = champClub?.name ?? toClubId;

  let next: ManagerCareer = { ...career };

  if (isUserReserve) {
    const nextReserveContracts = { ...(next.reserveContracts ?? {}) };
    delete nextReserveContracts[reserve.id];
    next = {
      ...next,
      reserves: next.reserves.filter((r) => r.id !== reserve.id),
      reserveContracts: nextReserveContracts,
      calledUpReserveIds: next.calledUpReserveIds.filter(
        (id) => id !== reserve.id
      ),
      matchdayInterchange: next.matchdayInterchange.map((id) =>
        id === reserve.id ? "" : id
      ),
      wageBill: computeCareerWageBill({
        ...next,
        reserveContracts: nextReserveContracts,
      } as ManagerCareer),
    };
  } else {
    next = {
      ...next,
      leagueClubReserves: {
        ...(next.leagueClubReserves ?? {}),
        [fromClub]: (next.leagueClubReserves?.[fromClub] ?? []).filter(
          (r) => r.id !== reserve.id
        ),
      },
    };
  }

  next = insertPlayerIntoChampionshipSquad(
    next,
    adaptReserveToChampionshipPlayer(reserve, toClubId, champClubName)
  );

  if (isUserReserve && fee > 0) {
    next = addTransferIncome(next, fee);
  }

  const transferId = `res-champ-${next.seasonYear}-w${week}-${reserve.id}`;
  const activity: LeagueTransferActivity = {
    id: transferId,
    week,
    playerId: reserve.id,
    playerName: reserve.name,
    fromClub,
    toClub: champClubName,
    fee,
    sourceSquad: "reserve",
    fromCompetitionId: "super-league",
    toCompetitionId: "championship",
    transferType: "permanent",
  };

  const posLabel = reserve.position.replace(/_/g, " ").toLowerCase();
  const newsItem = {
    id: `news-${transferId}`,
    week,
    type: "transfer" as const,
    text: `${champClubName} sign ${fromClub} reserve ${reserve.name} (${posLabel}, age ${reserve.age}) for ${formatWage(fee)}.`,
  };

  return {
    ...next,
    leagueTransfers: [activity, ...(next.leagueTransfers ?? [])].slice(
      0,
      MAX_TRANSFER_HISTORY
    ),
    latestNews: [newsItem, ...(next.latestNews ?? [])].slice(0, 10),
    reserveToChampionshipCooldowns: {
      ...(next.reserveToChampionshipCooldowns ?? {}),
      [reserve.id]:
        week +
        DEFAULT_TRANSFER_ACTIVITY_CONFIG.reserveToChampionship
          .cooldownWeeksPerPlayer,
    },
    championshipReserveSigningsThisSeason:
      (next.championshipReserveSigningsThisSeason ?? 0) + 1,
    reserveToChampionshipTransfersVersion: 1,
  };
}

function createReserveTransferOffer(
  career: ManagerCareer,
  params: {
    reserve: ManagerReservePlayer;
    buyerClubName: string;
    fee: number;
  }
): ManagerCareer {
  const { reserve, buyerClubName, fee } = params;
  const posLabel = reserve.position.replace(/_/g, " ").toLowerCase();
  const requestId = `champ-reserve-offer-${reserve.id}-w${career.gameWeek}`;
  const message: InboxMessage = {
    id: requestId,
    type: "transfer",
    title: "Championship Interest",
    body: `${buyerClubName} have offered ${formatWage(fee)} for reserve ${posLabel} ${reserve.name} to join their Championship squad.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId: reserve.id,
    playerName: reserve.name,
    offerClub: buyerClubName,
    offerAmount: fee,
    askingPrice: fee,
    reserveOffer: true,
    offerCategory: "reserve",
  };
  const withOffer = pushInboxMessage(career, message);
  return recordTransferOfferDiagnostic(withOffer, {
    requestId,
    targetPlayerId: reserve.id,
    targetSquad: "reserve",
    targetRole: "reserve",
    buyingClubId: buyerClubName,
    generatedWeek: career.gameWeek,
    generationPhase: getTransferOfferGenerationPhase(career.gameWeek),
    countedAgainstCategory: "reserve",
  });
}

/**
 * Weekly hook: Championship clubs scan Super League reserve squads for
 * fringe talent (CA 70–84) they can use as first-team depth. User reserves
 * generate a persistent inbox offer; AI-controlled reserve pools (only
 * populated for clubs the user has previously managed — see
 * managerClubChange.ts) are auto-resolved immediately.
 *
 * Deterministic per game week; most weeks produce no activity at all.
 */
export function maybeChampionshipBidForSlReserves(
  career: ManagerCareer
): ManagerCareer {
  if (!career.championshipSquads) return career;

  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG.reserveToChampionship;
  const heat = DEFAULT_TRANSFER_ACTIVITY_CONFIG.gameWeekActivityMultiplier(
    career.gameWeek
  );
  if ((career.championshipReserveSigningsThisSeason ?? 0) >= cfg.maxSigningsPerSeason) {
    return career;
  }
  const pendingReserveOffers = career.inboxMessages.filter(
    (m) => !m.resolved && m.reserveOffer
  ).length;
  if (pendingReserveOffers >= 3) return career;
  if (collectReserveCandidates(career, cfg).length === 0) return career;

  const rng = seedrandom(
    `${career.seed}-champ-reserve-bid-w${career.gameWeek}-s${career.seasonYear}`
  );
  const clubOrder = shuffle([...CHAMPIONSHIP_CLUBS], rng);
  const scanChance = Math.min(0.9, cfg.baseWeeklyScanChance * heat);

  let next = career;
  let worldRequests = 0;
  const clubRequests: Record<string, number> = {};

  for (const club of clubOrder) {
    if (worldRequests >= cfg.maxWorldRequestsPerWeek) break;
    if ((next.championshipReserveSigningsThisSeason ?? 0) >= cfg.maxSigningsPerSeason) {
      break;
    }
    if (rng() > scanChance) continue;
    if ((clubRequests[club.id] ?? 0) >= cfg.maxRequestsPerClubPerWeek) continue;
    if (
      (next.reserveToChampionshipClubCooldowns?.[club.id] ?? 0) >
      next.gameWeek
    ) {
      continue;
    }
    if (
      (next.reserveToChampionshipClubRequestCounts?.[club.id] ?? 0) >=
      cfg.maxRequestsPerClubPerSeason
    ) {
      continue;
    }

    const pool = collectReserveCandidates(next, cfg);
    if (pool.length === 0) break;

    const need = pickChampionshipClubNeed(next, club.id, rng);
    const picked = pickWeightedCandidate(pool, need, rng);
    if (!picked) continue;

    clubRequests[club.id] = (clubRequests[club.id] ?? 0) + 1;
    worldRequests += 1;
    next = {
      ...next,
      reserveToChampionshipClubCooldowns: {
        ...(next.reserveToChampionshipClubCooldowns ?? {}),
        [club.id]: next.gameWeek + cfg.cooldownWeeksPerClub,
      },
      reserveToChampionshipClubRequestCounts: {
        ...(next.reserveToChampionshipClubRequestCounts ?? {}),
        [club.id]:
          (next.reserveToChampionshipClubRequestCounts?.[club.id] ?? 0) + 1,
      },
    };

    const fee = computeReserveTransferFee(picked.reserve, rng);

    if (picked.isUser) {
      const stillPending = next.inboxMessages.filter(
        (m) => !m.resolved && m.reserveOffer
      ).length;
      if (stillPending >= 3) break;
      next = createReserveTransferOffer(next, {
        reserve: picked.reserve,
        buyerClubName: club.name,
        fee,
      });
      // Cooldown even while pending so deep sims don't re-target after expiry.
      next = {
        ...next,
        reserveToChampionshipCooldowns: {
          ...(next.reserveToChampionshipCooldowns ?? {}),
          [picked.reserve.id]: next.gameWeek + cfg.cooldownWeeksPerPlayer,
        },
      };
      continue;
    }

    const accepted = rng() < cfg.aiSellerAcceptChance;
    if (!accepted) {
      next = {
        ...next,
        reserveToChampionshipCooldowns: {
          ...(next.reserveToChampionshipCooldowns ?? {}),
          [picked.reserve.id]:
            next.gameWeek + Math.max(2, Math.round(cfg.cooldownWeeksPerPlayer / 2)),
        },
      };
      continue;
    }

    next = completeReserveToChampionshipTransfer(next, {
      reserve: picked.reserve,
      fromClub: picked.ownerClub,
      isUserReserve: false,
      toClubId: club.id,
      fee,
      week: next.gameWeek,
    });
  }

  if (next === career) return career;
  return { ...next, reserveToChampionshipTransfersVersion: 1 };
}

/** Accept a Championship club's bid for one of the user's reserve players. */
export function acceptReserveTransferOffer(
  career: ManagerCareer,
  messageId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  if (
    !msg ||
    msg.resolved ||
    !msg.reserveOffer ||
    !msg.playerId ||
    !msg.offerAmount ||
    !msg.offerClub
  ) {
    return { ok: false, error: "Offer not found." };
  }

  const reserve = career.reserves.find((r) => r.id === msg.playerId);
  if (!reserve) {
    return { ok: false, error: "This reserve has already left the club." };
  }

  const champClub = getChampionshipClubByName(msg.offerClub);
  if (!champClub) {
    return { ok: false, error: "Buying club could not be found." };
  }

  let next = completeReserveToChampionshipTransfer(career, {
    reserve,
    fromClub: career.club,
    isUserReserve: true,
    toClubId: champClub.id,
    fee: msg.offerAmount,
    week: career.gameWeek,
  });

  next = {
    ...next,
    inboxMessages: next.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true, read: true } : m
    ),
  };

  next = pushInboxMessage(next, {
    id: `champ-reserve-sale-${reserve.id}-w${career.gameWeek}`,
    type: "transfer_complete",
    title: "Reserve Sold",
    body: `${reserve.name} has joined ${champClub.name} for ${formatWage(msg.offerAmount)}.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId: reserve.id,
    playerName: reserve.name,
    offerClub: champClub.name,
    offerAmount: msg.offerAmount,
  });

  next = syncManagerFinance(next);

  return { ok: true, career: next };
}

/** Reject a Championship club's bid for a reserve, with a short interest cooldown. */
export function rejectReserveTransferOffer(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  const msg = career.inboxMessages.find((m) => m.id === messageId);
  const next: ManagerCareer = {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true, read: true } : m
    ),
  };
  if (!msg?.playerId) return next;
  return {
    ...next,
    reserveToChampionshipCooldowns: {
      ...(next.reserveToChampionshipCooldowns ?? {}),
      [msg.playerId]:
        next.gameWeek +
        Math.max(
          3,
          Math.round(
            DEFAULT_TRANSFER_ACTIVITY_CONFIG.reserveToChampionship
              .cooldownWeeksPerPlayer / 2
          )
        ),
    },
  };
}
