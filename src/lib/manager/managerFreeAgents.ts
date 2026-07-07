import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { FreeAgent, LeagueTransferActivity, ManagerCareer } from "./types";
import type { BuyOffer } from "./managerTransferLeague";
import { getProtectedTransferPlayerIds } from "./managerTransferLeague";
import { getPlayerSigningDemand } from "./managerTransfers";
import { getManagerPlayer } from "./managerPlayers";
import {
  generateInitialContract,
  formatWage,
} from "./managerContracts";
import { computeCareerWageBill } from "./managerReserveContracts";
import { getManagerClubTeamRating } from "./managerRating";
import {
  getLeagueClubRosterIds,
  getUserClubPlayerIds,
  reconcileLeagueRosters,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { createInitialPlayerState } from "./managerSquad";
import { syncManagerFinance, canAffordAdditionalWage, evaluateClubSigningAppeal, getManagerPlayerListingRating } from "./managerFinance";
import { pushInboxMessage, normalizeInboxMessage } from "./managerInbox";

const MAX_TRANSFER_HISTORY = 32;
const AI_FREE_AGENT_SIGN_CHANCE = 0.18;
const AI_CONTRACT_EXPIRY_CHANCE = 0.42;

export function getFreeAgentIds(career: ManagerCareer): Set<string> {
  return new Set((career.freeAgents ?? []).map((f) => f.playerId));
}

export function isFreeAgent(career: ManagerCareer, playerId: string): boolean {
  return getFreeAgentIds(career).has(playerId);
}

export function addPlayersToFreeAgents(
  career: ManagerCareer,
  entries: { playerId: string; formerClub: string }[],
  sinceSeason?: number
): ManagerCareer {
  if (entries.length === 0) return career;

  const existingIds = getFreeAgentIds(career);
  const userIds = getUserClubPlayerIds(career);
  const newAgents: FreeAgent[] = [...(career.freeAgents ?? [])];
  let leagueListedPlayers = career.leagueListedPlayers;
  let transferMarket = career.transferMarket;

  for (const { playerId, formerClub } of entries) {
    if (existingIds.has(playerId)) continue;
    if (userIds.has(playerId)) continue;

    leagueListedPlayers = leagueListedPlayers.filter(
      (l) => l.playerId !== playerId
    );
    transferMarket = transferMarket.filter((id) => id !== playerId);

    newAgents.push({
      playerId,
      formerClub,
      sinceWeek: career.gameWeek,
      sinceSeason: sinceSeason ?? career.seasonYear,
    });
    existingIds.add(playerId);
  }

  if (newAgents.length === (career.freeAgents ?? []).length) return career;

  return reconcileLeagueRosters({
    ...career,
    leagueListedPlayers,
    transferMarket,
    freeAgents: newAgents,
    updatedAt: new Date().toISOString(),
  });
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
  const appeal = evaluateClubSigningAppeal(career.club, rating);
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
  const entries: { playerId: string; formerClub: string }[] = [];

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    if (rng() > AI_CONTRACT_EXPIRY_CHANCE) continue;

    const roster = getLeagueClubRosterIds(career, club);
    const protectedIds = getProtectedTransferPlayerIds(career, club);
    const candidates = roster
      .filter((id) => !protectedIds.has(id) && !isFreeAgent(career, id))
      .map((id) => {
        const p = getManagerPlayer(career, id) ?? getPlayerById(id);
        return {
          id,
          rating: p?.peakRating ?? 70,
        };
      })
      .filter((c) => c.rating < 78)
      .sort((a, b) => a.rating - b.rating);

    if (candidates.length === 0) continue;
    const pick =
      candidates[Math.floor(rng() * Math.min(3, candidates.length))]!;
    entries.push({ playerId: pick.id, formerClub: club });
  }

  return addPlayersToFreeAgents(career, entries);
}

export function maybeAiSignFreeAgents(career: ManagerCareer): ManagerCareer {
  const pool = (career.freeAgents ?? []).filter(
    (f) => !career.squad.some((s) => s.playerId === f.playerId)
  );
  if (pool.length === 0) return career;

  const rng = seedrandom(
    `${career.seed}-fa-sign-w${career.gameWeek}-m${career.fixtures.length}`
  );
  if (rng() > AI_FREE_AGENT_SIGN_CHANCE) return career;

  const agent = pool[Math.floor(rng() * pool.length)]!;
  const otherClubs = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== career.club);
  if (otherClubs.length === 0) return career;
  const toClub = otherClubs[Math.floor(rng() * otherClubs.length)]!;

  const player =
    getManagerPlayer(career, agent.playerId) ?? getPlayerById(agent.playerId);
  if (!player) return career;

  const activity: LeagueTransferActivity = {
    id: `fa-ai-${career.gameWeek}-${agent.playerId}-${Date.now()}`,
    week: career.gameWeek,
    fromClub: agent.formerClub,
    toClub,
    playerId: agent.playerId,
    playerName: player.name,
    fee: 0,
  };

  const freeAgents = (career.freeAgents ?? []).filter(
    (f) => f.playerId !== agent.playerId
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
    agent.playerId,
    agent.formerClub,
    toClub
  );
}
