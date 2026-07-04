import seedrandom from "seedrandom";
import { POSITION_SHORT } from "../positions";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type {
  InboxMessage,
  ManagerCareer,
  PlayerContract,
  RetiredPlayer,
} from "./types";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";
import { computeWageBill } from "./managerContracts";
import {
  getLeagueClubRosterIds,
  initLeagueClubRosters,
  reconcileLeagueRosters,
} from "./managerLeagueRosters";
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

  // Persuaded to stay — honour renewed or active deals instead of age rolls.
  if (
    contract.status === "renewed" ||
    (!contract.expiresAtSeasonEnd && contract.yearsRemaining > 0)
  ) {
    return false;
  }

  if (age >= 39) return true;
  if (age >= 38) {
    const rng = seedrandom(
      `${career.seed}-retire-final-${playerId}-s${career.seasonYear}`
    );
    return rng() < 0.72;
  }
  return false;
}

/** AI league players — age-based retirement rolls each season. */
export function shouldRetireByAge(
  career: ManagerCareer,
  playerId: string,
  age: number
): boolean {
  if (age >= 39) return true;
  if (age >= 38) {
    const rng = seedrandom(
      `${career.seed}-retire-final-${playerId}-s${career.seasonYear}`
    );
    return rng() < 0.72;
  }
  const chance = getRetirementChanceForAge(age);
  if (chance <= 0) return false;
  const rng = seedrandom(
    `${career.seed}-ai-retire-roll-${playerId}-s${career.seasonYear}`
  );
  return rng() < chance;
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
  age: number,
  club: string
): RetiredPlayer | null {
  const player = getManagerPlayer(career, playerId);
  if (!player) return null;

  const ps = career.squad.find((p) => p.playerId === playerId);
  const totals = career.clubCareerTotals?.[playerId];
  const seasonStats = career.playerSeasonStats[playerId];
  const clubAppearances =
    totals?.appearances ??
    ps?.seasonAppearances ??
    seasonStats?.appearances ??
    0;
  const clubTries =
    totals?.tries ?? ps?.seasonTries ?? seasonStats?.tries ?? 0;
  const position = player.position;

  return {
    playerId,
    playerName: player.name,
    club,
    position,
    positionLabel: POSITION_SHORT[position] ?? position,
    age,
    peakRating: player.peakRating,
    seasonRetired: career.seasonYear,
    clubAppearances,
    clubTries,
    seasonsAtClub: totals?.seasons ?? (clubAppearances > 0 ? 1 : 0),
  };
}

/** Save-scoped apps/tries for a retired player (backfills legacy records). */
export function getRetiredPlayerSaveStats(
  career: ManagerCareer,
  record: RetiredPlayer
): { appearances: number; tries: number } {
  const totals = career.clubCareerTotals?.[record.playerId];
  return {
    appearances: Math.max(record.clubAppearances, totals?.appearances ?? 0),
    tries: Math.max(record.clubTries, totals?.tries ?? 0),
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

    const age = getManagerPlayerAge(next, ps.playerId) ?? 0;
    if (!isRetirementAge(age)) continue;
    if (contract.status === "renewed") continue;
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

/** Unread retirement-plan inbox item — surfaced as a popup before the hub. */
export function getPendingRetirementIntentPopup(
  career: ManagerCareer
): InboxMessage | undefined {
  return career.inboxMessages.find(
    (m) =>
      m.type === "retirement" &&
      m.id.startsWith("retirement-intent-") &&
      !m.read &&
      m.playerId
  );
}

export function acknowledgeRetirementIntentPopup(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, read: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
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

    const age = getManagerPlayerAge(next, ps.playerId) ?? 0;
    if (!shouldRetireAtSeasonEnd(career, ps.playerId, age, contract)) {
      continue;
    }

    const record = buildRetiredPlayerRecord(
      next,
      ps.playerId,
      age,
      career.club
    );
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

/** Retire veterans across AI club rosters at season rollover. */
export function applyLeagueRetirements(career: ManagerCareer): ManagerCareer {
  const rosters: Record<string, string[]> = {
    ...(career.leagueClubRosters ?? initLeagueClubRosters(career.club)),
  };
  const playerDevelopment = { ...(career.playerDevelopment ?? {}) };
  const playerRegistry = { ...career.playerRegistry };
  const retiredPlayers = [...(career.retiredPlayers ?? [])];
  let changed = false;

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    const ids = getLeagueClubRosterIds(career, club);
    const kept: string[] = [];

    for (const playerId of ids) {
      const age = getManagerPlayerAge(career, playerId) ?? 0;
      if (shouldRetireByAge(career, playerId, age)) {
        const record = buildRetiredPlayerRecord(career, playerId, age, club);
        if (record) {
          retiredPlayers.unshift(record);
        }
        changed = true;
        delete playerDevelopment[playerId];
        if (playerId.startsWith("mgr-ai-")) {
          delete playerRegistry[playerId];
        }
        continue;
      }
      kept.push(playerId);
    }

    rosters[club] = kept;
  }

  if (!changed) return career;

  return reconcileLeagueRosters({
    ...career,
    leagueClubRosters: rosters,
    playerDevelopment,
    playerRegistry,
    retiredPlayers,
    updatedAt: new Date().toISOString(),
  });
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

  return tickLeaguePlayerCareerTotals({ ...career, clubCareerTotals: totals });
}

/** Estimate league roster player stats from club results this season. */
export function tickLeaguePlayerCareerTotals(
  career: ManagerCareer
): ManagerCareer {
  const totals = { ...(career.clubCareerTotals ?? {}) };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;

    const rosterIds = getLeagueClubRosterIds(career, club);
    if (rosterIds.length === 0) continue;

    const clubRow = career.leagueTable.find((row) => row.team === club);
    const roundsPlayed = clubRow?.played ?? 0;
    if (roundsPlayed <= 0) continue;

    const sorted = [...rosterIds].sort((a, b) => {
      const ratingA = getManagerPlayer(career, a)?.peakRating ?? 70;
      const ratingB = getManagerPlayer(career, b)?.peakRating ?? 70;
      return ratingB - ratingA;
    });
    const regulars = sorted.slice(0, 17);
    const teamTries = Math.max(
      1,
      Math.round((clubRow?.pointsFor ?? roundsPlayed * 18) / 4)
    );
    const ratingSum = regulars.reduce(
      (sum, id) => sum + (getManagerPlayer(career, id)?.peakRating ?? 70),
      0
    );

    for (const playerId of regulars) {
      const existing = totals[playerId];
      const rating = getManagerPlayer(career, playerId)?.peakRating ?? 70;
      const tryShare =
        ratingSum > 0 ? (rating / ratingSum) * teamTries * 0.4 : 0;
      const seasonTries = Math.max(0, Math.round(tryShare));

      totals[playerId] = {
        appearances: (existing?.appearances ?? 0) + roundsPlayed,
        tries: (existing?.tries ?? 0) + seasonTries,
        seasons: (existing?.seasons ?? 0) + 1,
      };
    }
  }

  return { ...career, clubCareerTotals: totals };
}

export function clearRetirementIntentOnRenewal(
  contract: PlayerContract,
  seasonYear: number
): PlayerContract {
  return {
    ...contract,
    retiringAtSeasonEnd: false,
    // Lock intent for this season so sync does not re-roll after a new deal.
    retirementIntentSeason: seasonYear,
  };
}
