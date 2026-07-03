import seedrandom from "seedrandom";
import { getPlayerById, getPlayersByCategory } from "../players";
import { isHiddenPlayer } from "../players/goat";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { ManagerCareer } from "./types";
import type { ManagerInjury, InjuryType } from "./types";
import { createInitialPlayerState } from "./managerSquad";
import { getLeagueClubRosterIds } from "./managerLeagueRosters";
import {
  calculateWageForPlayer,
  computeWageBill,
  generateInitialContract,
  inferSquadRole,
} from "./managerContracts";
import { canAffordAdditionalWage } from "./managerFinance";
import { getManagerClubTeamRating } from "./managerRating";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";

const INJURY_POOL: { type: InjuryType; min: number; max: number; serious: boolean }[] = [
  { type: "knock", min: 1, max: 1, serious: false },
  { type: "minor_strain", min: 1, max: 2, serious: false },
  { type: "hamstring", min: 2, max: 4, serious: false },
  { type: "shoulder", min: 2, max: 5, serious: false },
  { type: "concussion", min: 2, max: 4, serious: true },
  { type: "knee", min: 4, max: 8, serious: true },
];

export interface TransferDemand {
  wagePerYear: number;
  yearsRequested: number;
  squadRole: ReturnType<typeof inferSquadRole>;
}

export function getTransferDemand(
  career: ManagerCareer,
  playerId: string
): TransferDemand {
  const player = getManagerPlayer(career, playerId);
  const rating = player?.peakRating ?? 70;
  const age = getManagerPlayerAge(career, playerId);
  const role = inferSquadRole(rating, false, age);
  const wage = calculateWageForPlayer(
    playerId,
    role,
    getManagerClubTeamRating(career.club),
    career
  );
  return {
    wagePerYear: wage,
    yearsRequested: rating >= 82 ? 2 : 1,
    squadRole: role,
  };
}

export function generateTransferMarket(
  career: ManagerCareer,
  seed: string,
  round: number
): string[] {
  const rng = seedrandom(`${seed}-transfers-r${round}`);
  const userSquadIds = new Set(career.squad.map((p) => p.playerId));
  const allCurrent = getPlayersByCategory("current").filter(
    (p) =>
      p.category === "current" &&
      p.availableInGame !== false &&
      !isHiddenPlayer(p) &&
      !userSquadIds.has(p.id)
  );

  const otherClubIds = new Set<string>();
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    for (const id of getLeagueClubRosterIds(career, club)) {
      otherClubIds.add(id);
    }
  }

  const pool = allCurrent.filter((p) => !otherClubIds.has(p.id) || rng() < 0.15);
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const count = 5 + Math.floor(rng() * 6);
  return shuffled.slice(0, count).map((p) => p.id);
}

export function canAffordPlayer(budget: number, playerId: string): boolean {
  const player = getPlayerById(playerId);
  if (!player) return false;
  return budget >= player.value;
}

export function canAffordWage(career: ManagerCareer, wage: number): boolean {
  return canAffordAdditionalWage(career, wage);
}

export function signPlayer(
  career: ManagerCareer,
  playerId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const player = getPlayerById(playerId);
  if (!player) return { ok: false, error: "Player not found" };
  if (career.squad.some((p) => p.playerId === playerId)) {
    return { ok: false, error: "Already in your squad" };
  }
  if (career.budget < player.value) {
    return { ok: false, error: "Insufficient transfer budget" };
  }

  const demand = getTransferDemand(career, playerId);
  if (!canAffordWage(career, demand.wagePerYear)) {
    return {
      ok: false,
      error: `Wage bill would exceed budget (${Math.round(demand.wagePerYear / 1000)}k/yr demand)`,
    };
  }
  if (career.squad.length >= 35) {
    return { ok: false, error: "Squad is full — release a player first" };
  }

  const rep = getManagerClubTeamRating(career.club);
  const contract = generateInitialContract(playerId, false, rep, career);
  contract.wagePerYear = demand.wagePerYear;
  contract.yearsRemaining = demand.yearsRequested;
  contract.squadRole = demand.squadRole;
  contract.expiresAtSeasonEnd = demand.yearsRequested <= 1;

  const nextContracts = {
    ...career.contracts,
    [playerId]: contract,
  };

  const next: ManagerCareer = {
    ...career,
    budget: career.budget - player.value,
    squad: [...career.squad, createInitialPlayerState(playerId)],
    contracts: nextContracts,
    wageBill: computeWageBill(nextContracts),
    transferMarket: career.transferMarket.filter((id) => id !== playerId),
    updatedAt: new Date().toISOString(),
  };
  return { ok: true, career: next };
}

/** @deprecated Use releasePlayerWithCost from managerTransferLeague. */
export function releasePlayer(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const xiii = career.matchdayXiii.filter((id) => id !== playerId);
  const interchange = career.matchdayInterchange.filter((id) => id !== playerId);
  const nextContracts = { ...career.contracts };
  delete nextContracts[playerId];

  return {
    ...career,
    squad: career.squad.filter((p) => p.playerId !== playerId),
    contracts: nextContracts,
    wageBill: computeWageBill(nextContracts),
    matchdayXiii: xiii,
    matchdayInterchange: interchange,
    updatedAt: new Date().toISOString(),
  };
}

export function rollPostMatchInjuries(
  squadIds: string[],
  seed: string,
  round: number,
  fatigueFactor: number,
  aggressiveDefence: boolean
): { playerId: string; injury: ManagerInjury }[] {
  const rng = seedrandom(`${seed}-injuries-r${round}`);
  const results: { playerId: string; injury: ManagerInjury }[] = [];

  for (const id of squadIds) {
    let risk = 0.04 * fatigueFactor;
    if (aggressiveDefence) risk += 0.02;
    const player = getPlayerById(id);
    if (!player) continue;

    if (rng() < risk) {
      const pick = INJURY_POOL[Math.floor(rng() * INJURY_POOL.length)]!;
      const duration =
        pick.min + Math.floor(rng() * (pick.max - pick.min + 1));
      results.push({
        playerId: id,
        injury: {
          type: pick.type,
          matchesRemaining: duration,
          serious: pick.serious,
        },
      });
    }
  }
  return results;
}

export function formatInjuryLabel(injury: ManagerInjury): string {
  const labels: Record<InjuryType, string> = {
    knock: "Knock",
    minor_strain: "Minor strain",
    hamstring: "Hamstring",
    shoulder: "Shoulder injury",
    concussion: "Concussion",
    knee: "Knee injury",
    suspension: "Suspension",
  };
  const name = labels[injury.type];
  if (injury.matchesRemaining <= 1) return `${name} — out 1 match`;
  return `${name} — out ${injury.matchesRemaining} matches`;
}
