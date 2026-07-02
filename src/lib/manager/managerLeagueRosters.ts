import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getPlayerById } from "../players";
import type { OpponentPoolOptions } from "../game/opponent-squad-strength";
import type { Player, Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getManagerRosterIds } from "./managerRating";
import { getManagerPlayer, reserveToPlayer } from "./managerPlayers";
import { createYouthProspect } from "./managerReserves";
import type { ManagerCareer } from "./types";

export type LeagueClubRosters = Record<string, string[]>;

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
  const stored = career.leagueClubRosters?.[club];
  if (stored && stored.length > 0) return stored;
  return getManagerRosterIds(club);
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

/**
 * Keep league rosters consistent: signed players leave other clubs,
 * no player appears on two clubs, and all AI clubs have a roster.
 */
export function reconcileLeagueRosters(career: ManagerCareer): ManagerCareer {
  const userPlayerIds = new Set(career.squad.map((p) => p.playerId));
  const freeAgentIds = new Set(
    (career.freeAgents ?? []).map((f) => f.playerId)
  );
  let rosters: LeagueClubRosters = {
    ...(career.leagueClubRosters ?? initLeagueClubRosters(career.club)),
  };

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    if (!rosters[club] || rosters[club].length < 13) {
      const base = getManagerRosterIds(club);
      const merged = new Set([...(rosters[club] ?? []), ...base]);
      rosters[club] = [...merged].filter((id) => !freeAgentIds.has(id));
    }
  }

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    rosters[club] = (rosters[club] ?? []).filter(
      (id) => !userPlayerIds.has(id) && !freeAgentIds.has(id)
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
  fromClub: string,
  toClub?: string
): ManagerCareer {
  const rosters: LeagueClubRosters = {
    ...(career.leagueClubRosters ?? initLeagueClubRosters(career.club)),
  };

  if (fromClub !== career.club && rosters[fromClub]) {
    rosters[fromClub] = rosters[fromClub]!.filter((id) => id !== playerId);
  }

  if (toClub && toClub !== career.club) {
    const list = rosters[toClub] ?? [];
    if (!list.includes(playerId)) {
      rosters[toClub] = [...list, playerId];
    }
  }

  return reconcileLeagueRosters({ ...career, leagueClubRosters: rosters });
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
        pos
      );
      const playerId = `mgr-ai-${club.replace(/\s+/g, "-")}-${career.seasonYear}-${i}-${Math.abs(hashCode(prospect.name))}`;
      const player = reserveToPlayer({ ...prospect, id: playerId });
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
  if (career.squad.some((p) => p.playerId === playerId)) {
    return career.club;
  }
  const rosters = career.leagueClubRosters ?? {};
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;
    if (rosters[club]?.includes(playerId)) return club;
  }
  return null;
}
