import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { decomposeRLScore, pickRLScore, snapToRLScore } from "../game/rl-scores";
import type { Position } from "../types";
import { POSITION_SHORT, SQUAD_STRUCTURE } from "../positions";
import type {
  ManagerCareer,
  ManagerReservePlayer,
  ReserveFixtureResult,
} from "./types";
import {
  addReserveCallUpInboxMessage,
  addReserveReturnInboxMessage,
} from "./managerInbox";
import { createInitialPlayerState } from "./managerSquad";
import { generateInitialContract } from "./managerContracts";
import {
  computeCareerWageBill,
} from "./managerReserveContracts";
import { getManagerClubTeamRating } from "./managerRating";
import { reserveToPlayer } from "./managerPlayers";
import type { Player } from "../types";

const FIRST_NAMES = [
  "Jack", "Tom", "Liam", "Ethan", "Noah", "Mason", "Harvey", "Finn",
  "Callum", "Ryan", "Luke", "Ben", "Sam", "Joe", "Max", "Ollie",
  "Kai", "Tyler", "Dylan", "Connor", "Josh", "Alex", "George", "Charlie",
];

const LAST_NAMES = [
  "Ashton", "Brooks", "Carter", "Davies", "Evans", "Fletcher", "Grant",
  "Hughes", "Ingram", "Johnson", "Knight", "Lewis", "Mason", "Nolan",
  "Owen", "Price", "Quinn", "Reid", "Shaw", "Taylor", "Walsh", "Young",
];

const NATIONALITIES = ["England", "Wales", "Scotland", "Ireland", "France", "Australia"];

function pickPotential(age: number, rng: () => number): number {
  const roll = rng();
  if (roll < 0.04) return 85 + Math.floor(rng() * 6);
  if (roll < 0.14) return 80 + Math.floor(rng() * 5);
  if (roll < 0.35) return 75 + Math.floor(rng() * 5);
  if (roll < 0.65) return 70 + Math.floor(rng() * 5);
  return 65 + Math.floor(rng() * 5);
}

function ratingForAge(age: number, potential: number, rng: () => number): number {
  if (age <= 18) return 55 + Math.floor(rng() * 14);
  if (age <= 20) return 60 + Math.floor(rng() * 13);
  return 63 + Math.floor(rng() * 13);
}

export function getPotentialTier(potential: number): string {
  if (potential >= 85) return "Elite Prospect";
  if (potential >= 80) return "High Potential";
  if (potential >= 75) return "Good Prospect";
  if (potential >= 70) return "Squad Potential";
  return "Depth Potential";
}

function generateReservePlayer(
  seed: string,
  index: number,
  position: Position
): ManagerReservePlayer {
  const rng = seedrandom(`${seed}-reserve-${index}`);
  const age = 17 + Math.floor(rng() * 6);
  const potential = pickPotential(age, rng);
  const rating = Math.min(
    potential,
    ratingForAge(age, potential, rng)
  );
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!;
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!;

  return {
    id: `mgr-res-${seed}-${index}`,
    name: `${first} ${last}`,
    age,
    nationality: NATIONALITIES[Math.floor(rng() * NATIONALITIES.length)]!,
    position,
    eligiblePositions: [position],
    rating,
    potentialRating: potential,
    developmentRate: 0.4 + rng() * 0.6,
    form: 50 + Math.floor(rng() * 25),
    fitness: 85 + Math.floor(rng() * 15),
    reserveAppearances: 0,
    reserveTries: 0,
    calledUpForNextMatch: false,
    baseRating: rating,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function createYouthProspect(
  seed: string,
  seasonYear: number,
  index: number,
  position: Position
): ManagerReservePlayer {
  const player = generateReservePlayer(`${seed}-y${seasonYear}`, index, position);
  return {
    ...player,
    id: `mgr-youth-${seasonYear}-${index}-${Math.abs(hashCode(player.name))}`,
  };
}

export function generateReserveSquad(
  seed: string,
  count = 24
): ManagerReservePlayer[] {
  const positions: Position[] = [];
  for (const { position, count: c } of SQUAD_STRUCTURE) {
    for (let i = 0; i < c; i++) positions.push(position);
  }
  const rng = seedrandom(`${seed}-reserve-pos`);
  const shuffled = [...positions].sort(() => rng() - 0.5);
  const reserves: ManagerReservePlayer[] = [];
  for (let i = 0; i < count; i++) {
    const pos = shuffled[i % shuffled.length] ?? "CENTRE";
    reserves.push(generateReservePlayer(seed, i, pos));
  }
  return reserves;
}

export function getReserveOpponent(club: string, round: number, seed: string): string {
  const others = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== club);
  const rng = seedrandom(`${seed}-res-opp-r${round}`);
  return others[Math.floor(rng() * others.length)]!;
}

export function simulateReserveFixture(
  career: ManagerCareer,
  round: number,
  opponentClub: string
): ReserveFixtureResult {
  const rng = seedrandom(`${career.seed}-res-fix-r${round}`);
  const squadRating =
    career.reserves.reduce((sum, r) => sum + r.rating, 0) /
    Math.max(1, career.reserves.length);
  const oppRating = 68 + rng() * 10;
  const diff = squadRating - oppRating + (rng() - 0.5) * 6;
  const userWins = rng() < 1 / (1 + Math.exp(-diff / 4));

  let userScore: number;
  let oppScore: number;
  if (userWins) {
    userScore = snapToRLScore(pickRLScore(14, 32, rng), false);
    oppScore = snapToRLScore(pickRLScore(0, 20, rng), false);
    if (userScore <= oppScore) userScore = oppScore + 2;
  } else {
    oppScore = snapToRLScore(pickRLScore(14, 32, rng), false);
    userScore = snapToRLScore(pickRLScore(0, 20, rng), false);
    if (oppScore <= userScore) oppScore = userScore + 2;
  }

  const userTries = decomposeRLScore(userScore).tries;
  const tryScorer =
    career.reserves.length > 0
      ? [...career.reserves].sort((a, b) => b.rating - a.rating)[0]!.name
      : undefined;

  return {
    round,
    opponent: `${opponentClub} Reserves`,
    opponentClub,
    userScore,
    oppScore,
    userWon: userWins,
    topPerformer: tryScorer,
    userTries,
  };
}

export function applyReserveMatchDevelopment(
  career: ManagerCareer,
  result: ReserveFixtureResult
): ManagerCareer {
  const rng = seedrandom(`${career.seed}-res-dev-r${result.round}`);
  const reserves = career.reserves.map((r) => {
    let next = { ...r };
    if (result.userWon) next.form = Math.min(99, next.form + 2);
    else next.form = Math.max(1, next.form - 1);

    const played = rng() < 0.35 + result.userTries * 0.05;
    if (played) {
      next.reserveAppearances++;
      if (rng() < 0.08 + next.rating / 500) {
        next.reserveTries++;
      }
    }

    if (next.rating < next.potentialRating && rng() < next.developmentRate * 0.15) {
      next.rating = Math.min(next.potentialRating, next.rating + 1);
    }
    next.rating = Math.max(next.baseRating, next.rating);

    return next;
  });

  return {
    ...career,
    reserves,
    reserveResults: [...career.reserveResults, result],
    lastReserveResult: result,
  };
}

export function callUpReserveForNextMatch(
  career: ManagerCareer,
  reserveId: string
): ManagerCareer {
  const reserve = career.reserves.find((r) => r.id === reserveId);
  if (!reserve) return career;

  const alreadyCalled = career.calledUpReserveIds.includes(reserveId);

  const interchange = [...career.matchdayInterchange];
  if (!interchange.includes(reserveId)) {
    const emptyIdx = interchange.findIndex((id) => !id);
    if (emptyIdx >= 0) interchange[emptyIdx] = reserveId;
    else if (interchange.length < 4) interchange.push(reserveId);
  }

  const reserves = career.reserves.map((r) =>
    r.id === reserveId ? { ...r, calledUpForNextMatch: true } : r
  );

  let next: ManagerCareer = {
    ...career,
    reserves,
    matchdayInterchange: interchange,
    calledUpReserveIds: [...new Set([...career.calledUpReserveIds, reserveId])],
  };

  if (!alreadyCalled) {
    next = addReserveCallUpInboxMessage(
      next,
      reserve.id,
      reserve.name,
      POSITION_SHORT[reserve.position]
    );
  }

  return next;
}

export function clearReserveCallUps(career: ManagerCareer): ManagerCareer {
  const calledSet = new Set(career.calledUpReserveIds);
  if (calledSet.size === 0) return career;

  const returned = career.reserves
    .filter((r) => calledSet.has(r.id))
    .map((r) => ({ id: r.id, name: r.name }));

  let next: ManagerCareer = {
    ...career,
    calledUpReserveIds: [],
    matchdayInterchange: career.matchdayInterchange.filter(
      (id) => !calledSet.has(id)
    ),
    reserves: career.reserves.map((r) => ({
      ...r,
      calledUpForNextMatch: false,
    })),
  };

  next = addReserveReturnInboxMessage(next, returned);

  return next;
}

export function promoteReserveToSquad(
  career: ManagerCareer,
  reserveId: string
): { ok: boolean; career?: ManagerCareer; error?: string } {
  const reserve = career.reserves.find((r) => r.id === reserveId);
  if (!reserve) return { ok: false, error: "Reserve not found" };
  if (career.squad.some((p) => p.playerId === reserveId)) {
    return { ok: false, error: "Already in squad" };
  }
  if (career.squad.length >= 35) {
    return { ok: false, error: "Squad is full" };
  }

  const player: Player = reserveToPlayer(reserve);
  const rep = getManagerClubTeamRating(career.club);
  const contract = generateInitialContract(reserveId, false, rep);
  contract.squadRole = "Prospect";
  contract.purchaseFee = 0;

  const nextReserveContracts = { ...(career.reserveContracts ?? {}) };
  delete nextReserveContracts[reserveId];
  const nextContracts = {
    ...career.contracts,
    [reserveId]: contract,
  };

  const next: ManagerCareer = {
    ...career,
    playerRegistry: { ...career.playerRegistry, [reserveId]: player },
    squad: [...career.squad, createInitialPlayerState(reserveId)],
    contracts: nextContracts,
    reserveContracts: nextReserveContracts,
    wageBill: computeCareerWageBill({
      ...career,
      contracts: nextContracts,
      reserveContracts: nextReserveContracts,
    }),
    reserves: career.reserves.filter((r) => r.id !== reserveId),
    calledUpReserveIds: career.calledUpReserveIds.filter(
      (id) => id !== reserveId
    ),
    matchdayInterchange: career.matchdayInterchange.filter(
      (id) => id !== reserveId
    ),
  };
  return { ok: true, career: next };
}

export function releaseReserve(
  career: ManagerCareer,
  reserveId: string
): ManagerCareer {
  const nextContracts = { ...(career.reserveContracts ?? {}) };
  delete nextContracts[reserveId];

  return {
    ...career,
    reserves: career.reserves.filter((r) => r.id !== reserveId),
    reserveContracts: nextContracts,
    calledUpReserveIds: career.calledUpReserveIds.filter(
      (id) => id !== reserveId
    ),
    matchdayInterchange: career.matchdayInterchange.filter(
      (id) => id !== reserveId
    ),
    wageBill: computeCareerWageBill({
      ...career,
      reserveContracts: nextContracts,
    }),
  };
}

export function developReserveFromFirstTeamAppearance(
  career: ManagerCareer,
  reserveId: string
): ManagerCareer {
  const reserves = career.reserves.map((r) => {
    if (r.id !== reserveId) return r;
    if (r.rating >= r.potentialRating) return r;
    return {
      ...r,
      rating: Math.min(r.potentialRating, r.rating + 1),
    };
  });
  return { ...career, reserves };
}
