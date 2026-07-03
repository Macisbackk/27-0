import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getPlayerById } from "../players";
import type { OpponentPoolOptions } from "../game/opponent-squad-strength";
import type { Player, Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import { buildDefaultLineup } from "./club-config";
import {
  computeManagerTeamRating,
  getManagerClubTeamRating,
  getManagerLineupForClub,
  getManagerRosterIds,
} from "./managerRating";
import { getManagerPlayer, reserveToPlayer } from "./managerPlayers";
import { createYouthProspect } from "./managerReserves";
import type { ManagerCareer } from "./types";

export type LeagueClubRosters = Record<string, string[]>;

/** Player IDs owned by the user's club (squad, reserves, youth intake). */
export function getUserClubPlayerIds(career: ManagerCareer): Set<string> {
  const ids = new Set<string>();
  for (const p of career.squad) ids.add(p.playerId);
  for (const r of career.reserves ?? []) ids.add(r.id);
  for (const y of career.youthProspects ?? []) ids.add(y.id);
  return ids;
}

function getFreeAgentIds(career: ManagerCareer): Set<string> {
  return new Set((career.freeAgents ?? []).map((f) => f.playerId));
}

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Strip user-owned and free-agent IDs from a roster list (read-path safety). */
function sanitizeRosterIds(career: ManagerCareer, ids: string[]): string[] {
  const userIds = getUserClubPlayerIds(career);
  const freeAgentIds = getFreeAgentIds(career);
  return dedupeIds(
    ids.filter((id) => !userIds.has(id) && !freeAgentIds.has(id))
  );
}

/** Initialise AI club rosters from the 2026 squad pools (user club excluded). */
export function initLeagueClubRosters(userClub: string): LeagueClubRosters {
  const rosters: LeagueClubRosters = {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === userClub) continue;
    rosters[club] = [...getManagerRosterIds(club)];
  }
  return rosters;
}

export function getLeagueClubRosterIds(
  career: ManagerCareer,
  club: string
): string[] {
  if (club === career.club) {
    return career.squad.map((p) => p.playerId);
  }
  const rosters = career.leagueClubRosters;
  const ids =
    rosters && club in rosters
      ? (rosters[club] ?? [])
      : getManagerRosterIds(club);
  return sanitizeRosterIds(career, ids);
}

export function getLeagueClubPlayerPool(
  career: ManagerCareer,
  club: string
): Player[] {
  const ids = getLeagueClubRosterIds(career, club);
  const players: Player[] = [];
  for (const id of ids) {
    const player = getManagerPlayer(career, id) ?? getPlayerById(id);
    if (player) players.push(player);
  }
  return players;
}

export function getManagerOpponentPoolOptions(
  career: ManagerCareer,
  club: string
): OpponentPoolOptions {
  const pool = getLeagueClubPlayerPool(career, club);
  return {
    currentSeasonOnly: true,
    poolOverride: pool.length > 0 ? pool : undefined,
  };
}

/** Stable lineup rating for a league club (development-aware). */
export function getLeagueClubStableRating(
  career: ManagerCareer,
  club: string
): number {
  const rosterIds = getLeagueClubRosterIds(career, club);
  const lineup = buildDefaultLineup(rosterIds);
  if (lineup) {
    return computeManagerTeamRating(
      lineup.xiiiIds,
      lineup.benchIds,
      lineup.slotPositions,
      career
    );
  }

  const fallback = getManagerLineupForClub(club);
  if (fallback.xiiiIds.some(Boolean)) {
    return computeManagerTeamRating(
      fallback.xiiiIds,
      fallback.benchIds,
      fallback.slotPositions,
      career
    );
  }

  return getManagerClubTeamRating(club);
}

/** Match-day opponent rating anchored to squad quality — limits random XIII variance. */
export function getManagerOpponentMatchRating(
  career: ManagerCareer,
  club: string,
  seed: string,
  round: number
): number {
  const poolOptions = getManagerOpponentPoolOptions(career, club);
  const matchSquadRating = getOpponentMatchRating(club, seed, round, poolOptions);
  const stableRating = getLeagueClubStableRating(career, club);
  return Math.round(stableRating * 0.74 + matchSquadRating * 0.26);
}

/**
 * Keep league rosters consistent: signed players leave other clubs,
 * no player appears on two clubs, and all AI clubs have a roster.
 */
export function reconcileLeagueRosters(career: ManagerCareer): ManagerCareer {
  const userPlayerIds = getUserClubPlayerIds(career);
  const freeAgentIds = getFreeAgentIds(career);
  let rosters: LeagueClubRosters = {
    ...(career.leagueClubRosters ?? initLeagueClubRosters(career.club)),
  };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    rosters[club] = dedupeIds(
      (rosters[club] ?? []).filter(
        (id) => !userPlayerIds.has(id) && !freeAgentIds.has(id)
      )
    );
  }

  const assigned = new Set<string>(userPlayerIds);
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    rosters[club] = (rosters[club] ?? []).filter((id) => {
      if (freeAgentIds.has(id)) return false;
      if (assigned.has(id)) return false;
      assigned.add(id);
      return true;
    });
  }

  return { ...career, leagueClubRosters: rosters };
}

export function ensureLeagueClubRosters(career: ManagerCareer): ManagerCareer {
  if (!career.leagueClubRosters || Object.keys(career.leagueClubRosters).length === 0) {
    return reconcileLeagueRosters({
      ...career,
      leagueClubRosters: initLeagueClubRosters(career.club),
    });
  }
  return reconcileLeagueRosters(career);
}

/** Move a player between AI club rosters (or off an AI club when joining the user). */
export function transferLeaguePlayer(
  career: ManagerCareer,
  playerId: string,
  _fromClub: string,
  toClub?: string
): ManagerCareer {
  const rosters: LeagueClubRosters = {
    ...(career.leagueClubRosters ?? initLeagueClubRosters(career.club)),
  };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    rosters[club] = (rosters[club] ?? []).filter((id) => id !== playerId);
  }

  if (toClub && toClub !== career.club) {
    rosters[toClub] = [...(rosters[toClub] ?? []), playerId];
  }

  return pruneLeagueListedPlayers(
    reconcileLeagueRosters({ ...career, leagueClubRosters: rosters })
  );
}

/** Add generated youth prospects to AI club rosters at season start. */
export function applyAiYouthIntakeToLeague(career: ManagerCareer): ManagerCareer {
  let next = career;
  const registry = { ...next.playerRegistry };
  const rosters: LeagueClubRosters = {
    ...(next.leagueClubRosters ?? initLeagueClubRosters(next.club)),
  };

  const positions: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    for (let i = 0; i < count; i++) positions.push(position);
  }

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;

    const rng = seedrandom(
      `${career.seed}-ai-youth-${club}-s${career.seasonYear}`
    );
    const count = 1 + Math.floor(rng() * 2);
    const shuffled = [...positions].sort(() => rng() - 0.5);
    const list = [...(rosters[club] ?? [])];

    for (let i = 0; i < count; i++) {
      const pos = shuffled[i % shuffled.length] ?? "CENTRE";
      const prospect = createYouthProspect(
        `${career.seed}-${club}`,
        career.seasonYear,
        i,
        pos,
        club
      );
      const playerId = `mgr-ai-${club.replace(/\s+/g, "-")}-${career.seasonYear}-${i}-${Math.abs(hashCode(prospect.name))}`;
      const player = reserveToPlayer({ ...prospect, id: playerId }, career.seasonYear);
      registry[playerId] = player;
      list.push(playerId);
    }

    rosters[club] = list;
  }

  next = { ...next, playerRegistry: registry, leagueClubRosters: rosters };
  return reconcileLeagueRosters(next);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function findPlayerLeagueClub(
  career: ManagerCareer,
  playerId: string
): string | null {
  if (getUserClubPlayerIds(career).has(playerId)) {
    return career.club;
  }
  const rosters = career.leagueClubRosters ?? {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    if (rosters[club]?.includes(playerId)) return club;
  }
  return null;
}

export function pruneLeagueListedPlayers(career: ManagerCareer): ManagerCareer {
  const leagueListedPlayers = career.leagueListedPlayers.filter((listing) => {
    const club = findPlayerLeagueClub(career, listing.playerId);
    return club === listing.club;
  });
  if (leagueListedPlayers.length === career.leagueListedPlayers.length) {
    return career;
  }
  return {
    ...career,
    leagueListedPlayers,
    transferMarket: leagueListedPlayers.map((l) => l.playerId),
  };
}
