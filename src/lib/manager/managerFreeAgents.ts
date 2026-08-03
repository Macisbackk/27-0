import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type {
  FreeAgent,
  FreeAgentSource,
  LeagueTransferActivity,
  ManagerCareer,
} from "./types";
import type { BuyOffer } from "./managerTransferLeague";
import { getProtectedTransferPlayerIds } from "./managerTransferLeague";
import { getPlayerSigningDemand } from "./managerTransfers";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";
import {
  generateInitialContract,
  formatWage,
} from "./managerContracts";
import { computeCareerWageBill } from "./managerReserveContracts";
import { getManagerClubTeamRating } from "./managerRating";
import { dispatchAchievementCheck } from "../achievements/achievementNotify";
import {
  getLeagueClubRosterIds,
  getUserClubPlayerIds,
  reconcileLeagueRosters,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { createInitialPlayerState } from "./managerSquad";
import { syncManagerFinance, canAffordAdditionalWage, evaluateClubSigningAppeal, getManagerPlayerListingRating } from "./managerFinance";
import { getCareerClubStars } from "./managerDifficulty";
import { pushInboxMessage, normalizeInboxMessage } from "./managerInbox";
import { getLeagueSeasonIndex } from "./managerLeagueSeason";
import { SQUAD_STRUCTURE } from "../positions";
import type { Position } from "../types";
import { computePlayerValue } from "../players/ratings";

const MAX_TRANSFER_HISTORY = 32;
/** Mid-season FA activity — kept high enough that AI clubs replace leavers. */
const BASE_AI_FREE_AGENT_SIGN_CHANCE = 0.38;
const BASE_AI_CONTRACT_EXPIRY_CHANCE = 0.32;
const FREE_AGENT_MIN_AGE = 18;
const FREE_AGENT_POOL_TARGET = 10;

const FA_FIRST_NAMES = [
  "Jack", "Tom", "Liam", "Ethan", "Noah", "Harvey", "Callum", "Ryan",
  "Luke", "Ben", "Sam", "Joe", "Max", "Kai", "Connor", "Josh", "Alex",
  "George", "Charlie", "Jordan", "Mitch", "Brad", "Dale", "Greg",
];
const FA_LAST_NAMES = [
  "Walker", "Smith", "Jones", "Brown", "Wilson", "Taylor", "Davies",
  "Evans", "Thomas", "Roberts", "Johnson", "White", "Harris", "Martin",
  "Thompson", "Clarke", "Wright", "Hall", "Green", "Baker",
];

export const FREE_AGENT_SOURCE_LABELS: Record<FreeAgentSource, string> = {
  released_by_club: "Released by club",
  unwanted_reserve: "Former higher-club reserve",
  higher_club_depth: "Former higher-club reserve",
  contract_expired: "Contract expired",
  returning_player: "Returning player",
  trialist: "Trialist",
};

export function formatFreeAgentSource(source?: FreeAgentSource): string {
  if (!source) return "Available free agent";
  return FREE_AGENT_SOURCE_LABELS[source];
}

/** Weighted FA age: 18–20 10%, 21–24 30%, 25–29 35%, 30–33 20%, 34–36 5%. */
export function pickWeightedFreeAgentAge(rng: () => number): number {
  const roll = rng();
  if (roll < 0.1) return 18 + Math.floor(rng() * 3);
  if (roll < 0.4) return 21 + Math.floor(rng() * 4);
  if (roll < 0.75) return 25 + Math.floor(rng() * 5);
  if (roll < 0.95) return 30 + Math.floor(rng() * 4);
  return 34 + Math.floor(rng() * 3);
}

function pickFreeAgentRating(rng: () => number): number {
  const roll = rng();
  if (roll < 0.45) return 58 + Math.floor(rng() * 11); // 58–68
  if (roll < 0.85) return 69 + Math.floor(rng() * 7); // 69–75
  if (roll < 0.97) return 76 + Math.floor(rng() * 5); // 76–80
  return 81 + Math.floor(rng() * 3); // 81–83 rare
}

function ageBandForSource(source: FreeAgentSource, rng: () => number): number {
  switch (source) {
    case "trialist":
      return 18 + Math.floor(rng() * 8); // 18–25
    case "returning_player":
      return 28 + Math.floor(rng() * 9); // 28–36
    case "contract_expired":
      return 23 + Math.floor(rng() * 11); // 23–33
    case "higher_club_depth":
    case "unwanted_reserve":
      return 20 + Math.floor(rng() * 10); // 20–29
    case "released_by_club":
    default:
      return pickWeightedFreeAgentAge(rng);
  }
}

function pickFreeAgentSource(rng: () => number): FreeAgentSource {
  const roll = rng();
  if (roll < 0.28) return "released_by_club";
  if (roll < 0.48) return "unwanted_reserve";
  if (roll < 0.66) return "higher_club_depth";
  if (roll < 0.82) return "contract_expired";
  if (roll < 0.92) return "returning_player";
  return "trialist";
}

function inferFreeAgentSource(
  age: number,
  rating: number,
  preferred?: FreeAgentSource
): FreeAgentSource {
  if (preferred) return preferred;
  if (age <= 25 && rating < 72) return "trialist";
  if (age >= 28) return "returning_player";
  if (rating <= 72) return "higher_club_depth";
  return "released_by_club";
}

function clampFreeAgentBirthYear(
  career: ManagerCareer,
  playerId: string,
  targetAge: number
): ManagerCareer {
  const player =
    career.playerRegistry?.[playerId] ??
    getManagerPlayer(career, playerId) ??
    getPlayerById(playerId);
  if (!player) return career;

  const birthYear = career.seasonYear - Math.max(FREE_AGENT_MIN_AGE, targetAge);
  const registry = {
    ...(career.playerRegistry ?? {}),
    [playerId]: {
      ...player,
      birthYear,
      dateOfBirth: undefined,
      yearsActive: `${Math.max(birthYear + 18, birthYear + 1)}–`,
    },
  };
  return { ...career, playerRegistry: registry };
}

function freeAgentSignChanceForCareer(career: ManagerCareer): number {
  const seasonIndex = getLeagueSeasonIndex(career);
  return Math.min(0.72, BASE_AI_FREE_AGENT_SIGN_CHANCE + seasonIndex * 0.05);
}

function contractExpiryChanceForCareer(career: ManagerCareer): number {
  const seasonIndex = getLeagueSeasonIndex(career);
  return Math.min(0.62, BASE_AI_CONTRACT_EXPIRY_CHANCE + seasonIndex * 0.04);
}

function releaseRatingCapForCareer(career: ManagerCareer): number {
  // Softer than before — avoid dumping mid-70s depth every year.
  return 74 + Math.min(5, Math.floor(getLeagueSeasonIndex(career) / 2));
}

export function getFreeAgentIds(career: ManagerCareer): Set<string> {
  return new Set((career.freeAgents ?? []).map((f) => f.playerId));
}

export function isFreeAgent(career: ManagerCareer, playerId: string): boolean {
  return getFreeAgentIds(career).has(playerId);
}

export function addPlayersToFreeAgents(
  career: ManagerCareer,
  entries: {
    playerId: string;
    formerClub: string;
    source?: FreeAgentSource;
  }[],
  sinceSeason?: number
): ManagerCareer {
  if (entries.length === 0) return career;

  const existingIds = getFreeAgentIds(career);
  const userIds = getUserClubPlayerIds(career);
  let next = career;
  const newAgents: FreeAgent[] = [...(career.freeAgents ?? [])];
  let leagueListedPlayers = career.leagueListedPlayers;
  let transferMarket = career.transferMarket;
  let added = 0;

  for (const { playerId, formerClub, source } of entries) {
    if (existingIds.has(playerId)) continue;
    if (userIds.has(playerId)) continue;

    let age = getManagerPlayerAge(next, playerId);
    if (age != null && age < FREE_AGENT_MIN_AGE) {
      const bumpTo = 18 + Math.floor(Math.abs(hashStr(playerId)) % 3);
      next = clampFreeAgentBirthYear(next, playerId, bumpTo);
      age = bumpTo;
    }
    if (age == null) {
      next = clampFreeAgentBirthYear(next, playerId, pickWeightedFreeAgentAge(() => 0.5));
      age = getManagerPlayerAge(next, playerId) ?? 24;
    }
    if (age < FREE_AGENT_MIN_AGE) continue;

    const player = getManagerPlayer(next, playerId) ?? getPlayerById(playerId);
    const rating = player?.peakRating ?? 70;

    leagueListedPlayers = leagueListedPlayers.filter(
      (l) => l.playerId !== playerId
    );
    transferMarket = transferMarket.filter((id) => id !== playerId);

    newAgents.push({
      playerId,
      formerClub,
      sinceWeek: next.gameWeek,
      sinceSeason: sinceSeason ?? next.seasonYear,
      source: inferFreeAgentSource(age, rating, source),
    });
    existingIds.add(playerId);
    added += 1;
  }

  if (added === 0) return next;

  return reconcileLeagueRosters({
    ...next,
    leagueListedPlayers,
    transferMarket,
    freeAgents: newAgents,
    updatedAt: new Date().toISOString(),
  });
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** Age up under-18 free agents and assign missing source labels. */
export function sanitizeFreeAgentsForCareer(
  career: ManagerCareer
): ManagerCareer {
  const agents = career.freeAgents ?? [];
  if (agents.length === 0) return career;

  let next = career;
  const sanitized: FreeAgent[] = [];

  for (const agent of agents) {
    let age = getManagerPlayerAge(next, agent.playerId);
    if (age != null && age < FREE_AGENT_MIN_AGE) {
      const bumpTo = 18 + Math.floor(Math.abs(hashStr(agent.playerId)) % 3);
      next = clampFreeAgentBirthYear(next, agent.playerId, bumpTo);
      age = bumpTo;
    }
    if (age == null) {
      const bumpTo = pickWeightedFreeAgentAge(
        seedrandom(`${next.seed}-fa-age-${agent.playerId}`)
      );
      next = clampFreeAgentBirthYear(next, agent.playerId, bumpTo);
      age = bumpTo;
    }

    const player =
      getManagerPlayer(next, agent.playerId) ?? getPlayerById(agent.playerId);
    if (!player) continue;

    sanitized.push({
      ...agent,
      source:
        agent.source ??
        inferFreeAgentSource(age, player.peakRating ?? 70),
    });
  }

  return {
    ...next,
    freeAgents: sanitized,
  };
}

/** Top up the FA pool with realistic released / depth / trialist profiles. */
export function ensureFreeAgentPool(career: ManagerCareer): ManagerCareer {
  let next = sanitizeFreeAgentsForCareer(career);
  const existing = next.freeAgents ?? [];
  if (existing.length >= FREE_AGENT_POOL_TARGET) return next;

  const need = FREE_AGENT_POOL_TARGET - existing.length;
  const rng = seedrandom(
    `${next.seed}-fa-pool-s${next.seasonYear}-w${next.gameWeek}-${existing.length}`
  );
  const positions: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    for (let i = 0; i < count; i++) positions.push(position);
  }

  const registry = { ...(next.playerRegistry ?? {}) };
  const newAgents: FreeAgent[] = [...existing];
  const existingIds = new Set(newAgents.map((a) => a.playerId));

  for (let i = 0; i < need; i++) {
    const source = pickFreeAgentSource(rng);
    const age = Math.max(FREE_AGENT_MIN_AGE, ageBandForSource(source, rng));
    const rating = pickFreeAgentRating(rng);
    const position =
      positions[Math.floor(rng() * positions.length)] ?? "CENTRE";
    const club =
      CURRENT_PLAYABLE_CLUBS[
        Math.floor(rng() * CURRENT_PLAYABLE_CLUBS.length)
      ] ?? "Free Agents";
    const first =
      FA_FIRST_NAMES[Math.floor(rng() * FA_FIRST_NAMES.length)] ?? "Sam";
    const last =
      FA_LAST_NAMES[Math.floor(rng() * FA_LAST_NAMES.length)] ?? "Walker";
    const playerId = `mgr-fa-${next.seasonYear}-${next.gameWeek}-${i}-${Math.abs(hashStr(`${first}${last}${source}`))}`;
    if (existingIds.has(playerId)) continue;

    registry[playerId] = {
      id: playerId,
      name: `${first} ${last}`,
      position,
      peakRating: rating,
      category: "current",
      club: "",
      value: computePlayerValue(rating, position, "current"),
      nationality: "England",
      birthYear: next.seasonYear - age,
      yearsActive: `${next.seasonYear - Math.max(1, age - 18)}–`,
      intlCaps: 0,
    };

    newAgents.push({
      playerId,
      formerClub: club,
      sinceWeek: next.gameWeek,
      sinceSeason: next.seasonYear,
      source,
    });
    existingIds.add(playerId);
  }

  return {
    ...next,
    playerRegistry: registry,
    freeAgents: newAgents,
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateFreeAgentOffer(
  career: ManagerCareer,
  playerId: string,
  offer: BuyOffer
): { accepted: boolean; reason: string } {
  if (!isFreeAgent(career, playerId)) {
    return { accepted: false, reason: "Player is not a free agent." };
  }

  const player = getManagerPlayer(career, playerId);
  if (!player) return { accepted: false, reason: "Player not found." };

  if (offer.transferFee > 0) {
    return {
      accepted: false,
      reason: "Free agents sign without a transfer fee.",
    };
  }

  const signing = getPlayerSigningDemand(career, playerId);
  const rating = getManagerPlayerListingRating(career, playerId);
  const appeal = evaluateClubSigningAppeal(
    career.club,
    rating,
    getCareerClubStars(career)
  );
  if (!appeal.allowed) {
    return { accepted: false, reason: appeal.reason ?? "Signing blocked." };
  }

  if (offer.wagePerYear < signing.minAcceptableWage) {
    return { accepted: false, reason: "Wage offer too low." };
  }
  if (offer.yearsRequested < signing.yearsRequested && rating >= 75) {
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

  return { accepted: true, reason: "Deal agreed." };
}

function createFreeAgentSigningMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string,
  formerClub: string,
  wagePerYear: number
) {
  return normalizeInboxMessage(
    {
      id: `fa-sign-${playerId}-w${career.gameWeek}-${Date.now()}`,
      type: "transfer_complete",
      title: "Free Transfer Completed",
      body: `${playerName} has joined on a free transfer (formerly ${formerClub}) on ${formatWage(wagePerYear)}/yr.`,
      read: false,
      resolved: false,
      playerId,
      playerName,
      offerClub: formerClub,
      offerAmount: 0,
    },
    career
  );
}

export function completeFreeAgentSigning(
  career: ManagerCareer,
  playerId: string,
  offer: BuyOffer
): ManagerCareer {
  const entry = career.freeAgents?.find((f) => f.playerId === playerId);
  const formerClub = entry?.formerClub ?? "Free Agents";

  const rep = getManagerClubTeamRating(career.club);
  const demand = getPlayerSigningDemand(career, playerId);
  const contract = generateInitialContract(playerId, false, rep, career);
  contract.wagePerYear = offer.wagePerYear;
  contract.yearsRemaining = offer.yearsRequested;
  contract.squadRole = demand.squadRole;
  contract.expiresAtSeasonEnd = offer.yearsRequested <= 1;
  contract.purchaseFee = 0;

  const nextContracts = { ...career.contracts, [playerId]: contract };
  const freeAgents = (career.freeAgents ?? []).filter(
    (f) => f.playerId !== playerId
  );

  const signed: ManagerCareer = syncManagerFinance(
    transferLeaguePlayer(
      {
        ...career,
        squad: [...career.squad, createInitialPlayerState(playerId)],
        contracts: nextContracts,
        wageBill: computeCareerWageBill({
          ...career,
          contracts: nextContracts,
        } as ManagerCareer),
        freeAgents,
        updatedAt: new Date().toISOString(),
      },
      playerId,
      formerClub,
      career.club
    )
  );

  const player = getPlayerById(playerId);
  dispatchAchievementCheck({ trigger: "player-signed", playerSigned: true });
  return pushInboxMessage(
    signed,
    createFreeAgentSigningMessage(
      signed,
      playerId,
      player?.name ?? "Player",
      formerClub,
      offer.wagePerYear
    )
  );
}

/** Release fringe AI squad players at season end to populate the free-agent pool. */
export function simulateAiContractExpiries(career: ManagerCareer): ManagerCareer {
  const rng = seedrandom(`${career.seed}-ai-expiry-s${career.seasonYear}`);
  const entries: {
    playerId: string;
    formerClub: string;
    source?: FreeAgentSource;
  }[] = [];

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    if (rng() > contractExpiryChanceForCareer(career)) continue;

    const roster = getLeagueClubRosterIds(career, club);
    const protectedIds = getProtectedTransferPlayerIds(career, club);
    const ratingCap = releaseRatingCapForCareer(career);
    const releaseSlots = Math.min(
      2,
      1 + Math.floor(getLeagueSeasonIndex(career) / 3)
    );
    const candidates = roster
      .filter((id) => !protectedIds.has(id) && !isFreeAgent(career, id))
      .map((id) => {
        const p = getManagerPlayer(career, id) ?? getPlayerById(id);
        const age = getManagerPlayerAge(career, id) ?? 26;
        return {
          id,
          rating: p?.peakRating ?? 70,
          age,
        };
      })
      .filter((c) => c.rating < ratingCap && c.age >= FREE_AGENT_MIN_AGE)
      .sort((a, b) => a.rating - b.rating);

    for (let i = 0; i < releaseSlots && candidates.length > 0; i++) {
      const pick =
        candidates[Math.floor(rng() * Math.min(4, candidates.length))]!;
      const source: FreeAgentSource =
        pick.rating <= 72
          ? "higher_club_depth"
          : pick.age >= 30
            ? "contract_expired"
            : "released_by_club";
      entries.push({
        playerId: pick.id,
        formerClub: club,
        source,
      });
      const idx = candidates.findIndex((c) => c.id === pick.id);
      if (idx >= 0) candidates.splice(idx, 1);
    }
  }

  return ensureFreeAgentPool(addPlayersToFreeAgents(career, entries));
}

export function maybeAiSignFreeAgents(
  career: ManagerCareer,
  attempt = 0
): ManagerCareer {
  const pool = (career.freeAgents ?? []).filter(
    (f) => !career.squad.some((s) => s.playerId === f.playerId)
  );
  if (pool.length === 0) return career;

  const rng = seedrandom(
    `${career.seed}-fa-sign-w${career.gameWeek}-m${career.fixtures.length}-a${attempt}`
  );
  if (rng() > freeAgentSignChanceForCareer(career)) return career;

  const otherClubs = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== career.club);
  if (otherClubs.length === 0) return career;

  // Prefer clubs with the weakest squad average so mid-table sides recover.
  const clubRanks = otherClubs
    .map((club) => {
      const ratings = getLeagueClubRosterIds(career, club)
        .map((id) => getManagerPlayer(career, id)?.peakRating ?? 0)
        .filter((r) => r > 0);
      const avg =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 72;
      return { club, avg };
    })
    .sort((a, b) => a.avg - b.avg);

  const shortlist = clubRanks.slice(0, Math.min(5, clubRanks.length));
  const toClub =
    shortlist[Math.floor(rng() * shortlist.length)]?.club ??
    otherClubs[Math.floor(rng() * otherClubs.length)]!;
  const squadAvg =
    clubRanks.find((row) => row.club === toClub)?.avg ?? 72;

  const scored = pool
    .map((agent) => {
      const player =
        getManagerPlayer(career, agent.playerId) ?? getPlayerById(agent.playerId);
      if (!player) return null;
      return {
        agent,
        player,
        upgrade: player.peakRating - squadAvg,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row != null && row.upgrade >= -4
    )
    .sort((a, b) => b.upgrade - a.upgrade);

  const pick = scored[0];
  if (!pick) return career;

  const activity: LeagueTransferActivity = {
    id: `fa-ai-w${career.gameWeek}-a${attempt}-${pick.agent.playerId}`,
    week: career.gameWeek,
    fromClub: pick.agent.formerClub,
    toClub,
    playerId: pick.agent.playerId,
    playerName: pick.player.name,
    fee: 0,
  };

  const freeAgents = (career.freeAgents ?? []).filter(
    (f) => f.playerId !== pick.agent.playerId
  );

  return transferLeaguePlayer(
    {
      ...career,
      freeAgents,
      leagueTransfers: [activity, ...(career.leagueTransfers ?? [])].slice(
        0,
        MAX_TRANSFER_HISTORY
      ),
    },
    pick.agent.playerId,
    pick.agent.formerClub,
    toClub
  );
}
