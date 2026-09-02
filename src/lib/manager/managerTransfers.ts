import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import type { ManagerCareer } from "./types";
import type { ManagerInjury, InjuryType } from "./types";
import {
  calculateWageForPlayer,
  inferSquadRole,
} from "./managerContracts";
import {
  canAffordAdditionalWage,
  evaluateClubSigningAppeal,
  getManagerPlayerListingRating,
} from "./managerFinance";
import { getCareerClubStars } from "./managerDifficulty";
import { getUserCompetitionId } from "./leagueMembership";
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

/** Wage/terms the player expects from your club (includes tier premium when applicable). */
export interface PlayerSigningDemand extends TransferDemand {
  minAcceptableWage: number;
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

/** Player wage demand at your club — matches transfer evaluation logic. */
export function getPlayerSigningDemand(
  career: ManagerCareer,
  playerId: string
): PlayerSigningDemand {
  const base = getTransferDemand(career, playerId);
  const rating = getManagerPlayerListingRating(career, playerId);
  const appeal = evaluateClubSigningAppeal(
    career.club,
    rating,
    getCareerClubStars(career),
    getUserCompetitionId(career)
  );
  const wagePerYear = Math.round(base.wagePerYear * appeal.wagePremium);
  return {
    wagePerYear,
    yearsRequested: base.yearsRequested,
    squadRole: base.squadRole,
    minAcceptableWage: Math.round(wagePerYear * 0.9),
  };
}

export function canAffordWage(career: ManagerCareer, wage: number): boolean {
  return canAffordAdditionalWage(career, wage);
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
