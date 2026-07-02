import seedrandom from "seedrandom";
import { POSITION_SHORT } from "../positions";
import { getPlayerAge } from "../players/player-age";
import type {
  ManagerCareer,
  PlayerContract,
  RetiredPlayer,
} from "./types";
import { getManagerPlayer } from "./managerPlayers";
import { computeWageBill } from "./managerContracts";
import { reconcileLeagueRosters } from "./managerLeagueRosters";
import {
  addPlayerRetiredInboxMessage,
  addRetirementIntentInboxMessage,
} from "./managerInbox";

const RETIREMENT_INTENT_MIN_WEEK = 10;

/** Base chance a player will retire at season end (ages 34–38). */
export function getRetirementChanceForAge(age: number): number {
  if (age < 34) return 0;
  if (age === 34) return 0.14;
  if (age === 35) return 0.24;
  if (age === 36) return 0.38;
  if (age === 37) return 0.55;
  if (age === 38) return 0.78;
  return 0.95;
}

export function isRetirementAge(age: number): boolean {
  return age >= 34;
}

function rollRetirementIntent(
  career: ManagerCareer,
  playerId: string,
  age: number
): boolean {
  const chance = getRetirementChanceForAge(age);
  if (chance <= 0) return false;
  const rng = seedrandom(
    `${career.seed}-retire-intent-${playerId}-s${career.seasonYear}`
  );
  return rng() < chance;
}

export function shouldRetireAtSeasonEnd(
  career: ManagerCareer,
  playerId: string,
  age: number,
  contract: PlayerContract
): boolean {
  if (contract.retiringAtSeasonEnd) return true;
  if (age >= 39) return true;
  if (age >= 38) {
    const rng = seedrandom(
      `${career.seed}-retire-final-${playerId}-s${career.seasonYear}`
    );
    return rng() < 0.72;
  }
  return false;
}

function removeRetiredPlayerFromSquad(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const nextContracts = { ...career.contracts };
  delete nextContracts[playerId];

  const nextTransfer = { ...career.playerTransferStatus };
  delete nextTransfer[playerId];

  const nextDevelopment = { ...(career.playerDevelopment ?? {}) };
  delete nextDevelopment[playerId];

  const nextTotals = { ...(career.clubCareerTotals ?? {}) };

  return {
    ...career,
    squad: career.squad.filter((p) => p.playerId !== playerId),
    contracts: nextContracts,
    playerTransferStatus: nextTransfer,
    playerDevelopment: nextDevelopment,
    clubCareerTotals: nextTotals,
    leagueListedPlayers: career.leagueListedPlayers.filter(
      (row) => row.playerId !== playerId
    ),
    matchdayXiii: career.matchdayXiii.map((id) =>
      id === playerId ? "" : id
    ),
    matchdayInterchange: career.matchdayInterchange.map((id) =>
      id === playerId ? "" : id
    ),
    wageBill:
      computeWageBill(nextContracts) +
      computeWageBill(career.reserveContracts ?? {}),
  };
}

function buildRetiredPlayerRecord(
  career: ManagerCareer,
  playerId: string,
  age: number
): RetiredPlayer | null {
  const player = getManagerPlayer(career, playerId);
  if (!player) return null;

  const ps = career.squad.find((p) => p.playerId === playerId);
  const totals = career.clubCareerTotals?.[playerId];
  const clubAppearances =
    (totals?.appearances ?? 0) + (ps?.seasonAppearances ?? 0);
  const clubTries = (totals?.tries ?? 0) + (ps?.seasonTries ?? 0);
  const position = player.position;

  return {
    playerId,
    playerName: player.name,
    position,
    positionLabel: POSITION_SHORT[position] ?? position,
    age,
    peakRating: player.peakRating,
    seasonRetired: career.seasonYear,
    clubAppearances,
    clubTries,
    seasonsAtClub: totals?.seasons ?? 1,
  };
}

/** Roll and flag veterans considering retirement (mid-season inbox). */
export function ensureRetirementIntent(career: ManagerCareer): ManagerCareer {
  if (career.gameWeek < RETIREMENT_INTENT_MIN_WEEK || career.isSeasonComplete) {
    return career;
  }

  let next = career;

  for (const ps of next.squad) {
    const contract = next.contracts[ps.playerId];
    const player = getManagerPlayer(next, ps.playerId);
    if (!contract || !player) continue;

    const age = getPlayerAge(player) ?? 0;
    if (!isRetirementAge(age)) continue;
    if (contract.retirementIntentSeason === career.seasonYear) continue;

    const willRetire = rollRetirementIntent(career, ps.playerId, age);
    const nextContracts = { ...next.contracts };
    nextContracts[ps.playerId] = {
      ...contract,
      retirementIntentSeason: career.seasonYear,
      retiringAtSeasonEnd: willRetire,
    };

    next = { ...next, contracts: nextContracts };

    if (willRetire) {
      next = addRetirementIntentInboxMessage(
        next,
        ps.playerId,
        player.name,
        age
      );
    }
  }

  return next;
}

/** Remove retiring players at season rollover and archive them. */
export function applySeasonRetirements(career: ManagerCareer): {
  career: ManagerCareer;
  retiredIds: string[];
} {
  const retiredIds: string[] = [];
  const retiredPlayers = [...(career.retiredPlayers ?? [])];
  let next = career;

  for (const ps of career.squad) {
    const contract = career.contracts[ps.playerId];
    const player = getManagerPlayer(career, ps.playerId);
    if (!contract || !player) continue;

    const age = getPlayerAge(player) ?? 0;
    if (!shouldRetireAtSeasonEnd(career, ps.playerId, age, contract)) {
      continue;
    }

    const record = buildRetiredPlayerRecord(next, ps.playerId, age);
    if (record) {
      retiredPlayers.unshift(record);
    }

    next = addPlayerRetiredInboxMessage(
      next,
      ps.playerId,
      player.name,
      age
    );
    next = removeRetiredPlayerFromSquad(next, ps.playerId);
    retiredIds.push(ps.playerId);
  }

  if (retiredIds.length === 0) return { career, retiredIds };

  return {
    career: reconcileLeagueRosters({
      ...next,
      retiredPlayers,
      updatedAt: new Date().toISOString(),
    }),
    retiredIds,
  };
}

/** Accumulate per-player club totals before squad is reset for the new season. */
export function tickClubCareerTotals(career: ManagerCareer): ManagerCareer {
  const totals = { ...(career.clubCareerTotals ?? {}) };

  for (const ps of career.squad) {
    const existing = totals[ps.playerId];
    totals[ps.playerId] = {
      appearances: (existing?.appearances ?? 0) + ps.seasonAppearances,
      tries: (existing?.tries ?? 0) + ps.seasonTries,
      seasons: (existing?.seasons ?? 0) + 1,
    };
  }

  return { ...career, clubCareerTotals: totals };
}

export function clearRetirementIntentOnRenewal(
  contract: PlayerContract
): PlayerContract {
  return {
    ...contract,
    retiringAtSeasonEnd: false,
    retirementIntentSeason: undefined,
  };
}
