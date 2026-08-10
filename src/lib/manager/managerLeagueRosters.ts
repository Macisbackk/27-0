import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS, isSameManagerClub } from "../clubs/super-league-display";
import {
  getChampionshipClubByName,
} from "../clubs/championship-clubs";
import { getClubBaseStrength } from "../game/club-strength";
import { getPlayerById } from "../players";
import type { OpponentPoolOptions } from "../game/opponent-squad-strength";
import type { Player, Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import { getManagerClubTeamRating, getManagerRosterIds } from "./managerRating";
import {
  aiClubYouthLevel,
  getLeagueSeasonIndex,
  initAiYouthDevelopment,
} from "./managerLeagueSeason";
import { getManagerPlayer, reserveToPlayer } from "./managerPlayers";
import { createYouthProspect } from "./managerReserves";
import {
  championshipPlayerToPlayer,
  type ChampionshipGeneratedPlayer,
} from "./championship/championshipSquads";
import {
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  isUserInChampionship,
  resolveClubCompetitionForCareer,
} from "./leagueMembership";
import type { ManagerCareer } from "./types";

export type LeagueClubRosters = Record<string, string[]>;

function getTrackedLeagueClubs(career: ManagerCareer): string[] {
  const clubs = new Set<string>([
    ...CURRENT_PLAYABLE_CLUBS,
    ...getCareerSuperLeagueClubs(career),
    ...getCareerChampionshipClubs(career),
  ]);
  clubs.delete(career.club);
  return [...clubs];
}

/** Clubs that can list players on the transfer/loan market (SL + Championship). */
export function getTrackedLeagueClubsForTransferMarket(
  career: ManagerCareer
): string[] {
  return getTrackedLeagueClubs(career);
}

function isChampionshipSide(career: ManagerCareer, club: string): boolean {
  return resolveClubCompetitionForCareer(club, career) === "championship";
}

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

/** Roster IDs for a club without ownership / free-agent filtering. */
function getRawLeagueClubRosterIds(
  career: ManagerCareer,
  club: string
): string[] {
  if (club === career.club) {
    return career.squad.map((p) => p.playerId);
  }
  const rosters = career.leagueClubRosters;
  const tracked = rosters?.[club];
  if (tracked && tracked.length > 0) {
    return tracked;
  }
  // Championship AI sides live on championshipSquads; reconcile may leave an
  // empty leagueClubRosters entry that must not hide the real roster.
  if (isChampionshipSide(career, club) && career.championshipSquads) {
    const champ = getChampionshipClubByName(club);
    if (champ) {
      const champIds =
        career.championshipSquads.rosterByClub[champ.id] ?? [];
      if (champIds.length > 0) return champIds;
    }
  }
  if (tracked) return tracked;
  return getManagerRosterIds(club);
}

export function getLeagueClubRosterIds(
  career: ManagerCareer,
  club: string
): string[] {
  return sanitizeRosterIds(career, getRawLeagueClubRosterIds(career, club));
}

/**
 * Fast club lookup for every non-user league player (SL + Championship).
 * Builds skip sets once instead of re-sanitizing per club.
 */
export function buildLeaguePlayerClubMap(
  career: ManagerCareer
): Map<string, string> {
  const skip = getUserClubPlayerIds(career);
  for (const free of career.freeAgents ?? []) {
    skip.add(free.playerId);
  }
  const map = new Map<string, string>();
  for (const club of getTrackedLeagueClubs(career)) {
    if (isSameManagerClub(club, career.club)) continue;
    for (const id of getRawLeagueClubRosterIds(career, club)) {
      if (skip.has(id) || map.has(id)) continue;
      map.set(id, club);
    }
  }
  return map;
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
  if (players.length > 0) return players;

  // Challenge Cup / Championship sides live on championshipSquads, not league rosters.
  if (isChampionshipSide(career, club) && career.championshipSquads) {
    const champ = getChampionshipClubByName(club);
    if (!champ) return [];
    const roster = career.championshipSquads.rosterByClub[champ.id] ?? [];
    return roster
      .map((id) => getManagerPlayer(career, id) ?? getPlayerById(id))
      .filter((p): p is Player => Boolean(p));
  }

  return [];
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
 * Stable lineup rating for a league club (development-aware).
 *
 * Cup-tier dampening (baseStrength − 14) only applies when a Super League
 * user faces Championship sides. Champ users vs Champ peers (including after
 * relegation) stay on the peakRating scale so they match AI Champ fixtures.
 * After promotion, isUserInChampionship is false → SL peers use raw peakRating.
 */
export function getLeagueClubStableRating(
  career: ManagerCareer,
  club: string
): number {
  const pool = getLeagueClubPlayerPool(career, club);
  const champSide = isChampionshipSide(career, club);
  const dampenChampForSlUser =
    champSide && !isUserInChampionship(career);

  if (pool.length === 0) {
    if (champSide) {
      // SL user: cup-tier scale. Champ user: raw Champ baseStrength (~54–74).
      return dampenChampForSlUser
        ? getClubBaseStrength(club)
        : (getChampionshipClubByName(club)?.baseStrength ?? 62);
    }
    return getManagerClubTeamRating(club);
  }

  const ranked = [...pool].sort((a, b) => b.peakRating - a.peakRating);
  const sample = ranked.slice(0, 17);
  const total = sample.reduce((sum, player) => sum + player.peakRating, 0);
  const avg = Math.round(total / sample.length);

  // Championship peak ratings (70–89) sit on a lower competition band than
  // Super League (80+). Pull cup/opponent ratings toward the tier-offset
  // club strength so SL sides still dominate — only when the user is in SL.
  if (dampenChampForSlUser) {
    const tier = getClubBaseStrength(club);
    return Math.round(avg * 0.45 + tier * 0.55);
  }

  return avg;
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

  for (const club of getTrackedLeagueClubs(career)) {
    if (club === career.club) continue;
    rosters[club] = dedupeIds(
      (rosters[club] ?? []).filter(
        (id) => !userPlayerIds.has(id) && !freeAgentIds.has(id)
      )
    );
  }

  const assigned = new Set<string>(userPlayerIds);
  for (const club of getTrackedLeagueClubs(career)) {
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
  let next = career;
  const rosters: LeagueClubRosters = {
    ...(next.leagueClubRosters ?? initLeagueClubRosters(next.club)),
  };

  for (const club of getTrackedLeagueClubs(next)) {
    if (club === next.club) continue;
    rosters[club] = (rosters[club] ?? []).filter((id) => id !== playerId);
  }

  if (toClub && toClub !== next.club) {
    rosters[toClub] = [...(rosters[toClub] ?? []), playerId];
  }

  const squads = next.championshipSquads;
  const champPlayer = squads?.players[playerId];
  if (squads && champPlayer) {
    const rosterByClub: Record<string, string[]> = {};
    for (const [clubId, ids] of Object.entries(squads.rosterByClub)) {
      rosterByClub[clubId] = ids.filter((id) => id !== playerId);
    }

    let updated: ChampionshipGeneratedPlayer = { ...champPlayer };
    const destChamp =
      toClub && toClub !== next.club
        ? getChampionshipClubByName(toClub)
        : null;

    if (destChamp) {
      rosterByClub[destChamp.id] = [
        ...(rosterByClub[destChamp.id] ?? []),
        playerId,
      ];
      updated = {
        ...updated,
        clubId: destChamp.id,
        clubName: toClub!,
      };
    } else {
      // User club or Super League AI — keep the player record for lookup/return.
      updated = {
        ...updated,
        clubId: "super-league",
        clubName: toClub ?? next.club,
      };
      if (!toClub || toClub === next.club) {
        next = {
          ...next,
          playerRegistry: {
            ...next.playerRegistry,
            [playerId]: championshipPlayerToPlayer({
              ...updated,
              clubName: next.club,
            }),
          },
        };
      }
    }

    next = {
      ...next,
      championshipSquads: {
        ...squads,
        rosterByClub,
        players: { ...squads.players, [playerId]: updated },
      },
    };
  }

  return pruneLeagueListedPlayers(
    reconcileLeagueRosters({ ...next, leagueClubRosters: rosters })
  );
}

/** Add generated youth prospects to AI club rosters at season start. */
export function applyAiYouthIntakeToLeague(career: ManagerCareer): ManagerCareer {
  let next = career;
  const registry = { ...next.playerRegistry };
  const playerDevelopment = { ...(next.playerDevelopment ?? {}) };
  const rosters: LeagueClubRosters = {
    ...(next.leagueClubRosters ?? initLeagueClubRosters(next.club)),
  };
  const seasonIndex = getLeagueSeasonIndex(career);

  const positions: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    for (let i = 0; i < count; i++) positions.push(position);
  }

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === career.club) continue;

    const rng = seedrandom(
      `${career.seed}-ai-youth-${club}-s${career.seasonYear}`
    );
    const youthLevel = aiClubYouthLevel(club);
    const baseCount = 2 + Math.floor(seasonIndex / 2);
    const count = Math.min(5, baseCount + Math.floor(rng() * 2));
    const shuffled = [...positions].sort(() => rng() - 0.5);
    const list = [...(rosters[club] ?? [])];

    for (let i = 0; i < count; i++) {
      const pos = shuffled[i % shuffled.length] ?? "CENTRE";
      const prospect = createYouthProspect(
        `${career.seed}-${club}`,
        career.seasonYear,
        i,
        pos,
        club,
        youthLevel
      );
      const playerId = `mgr-ai-${club.replace(/\s+/g, "-")}-${career.seasonYear}-${i}-${Math.abs(hashCode(prospect.name))}`;
      const player = reserveToPlayer({ ...prospect, id: playerId }, career.seasonYear);
      // Nudge AI youth toward first-team usefulness; user academy is separate.
      const boostedRating = Math.min(
        prospect.potentialRating - 1,
        player.peakRating + 3
      );
      const boostedPlayer = { ...player, peakRating: boostedRating };
      registry[playerId] = boostedPlayer;
      playerDevelopment[playerId] = initAiYouthDevelopment(
        career,
        playerId,
        boostedRating,
        prospect.potentialRating,
        prospect.developmentRate
      );
      list.push(playerId);
    }

    rosters[club] = list;
  }

  next = {
    ...next,
    playerRegistry: registry,
    playerDevelopment,
    leagueClubRosters: rosters,
  };
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
  for (const club of getTrackedLeagueClubs(career)) {
    if (isSameManagerClub(club, career.club)) continue;
    if (getRawLeagueClubRosterIds(career, club).includes(playerId)) {
      return club;
    }
  }
  return null;
}

export function pruneLeagueListedPlayers(career: ManagerCareer): ManagerCareer {
  const leagueListedPlayers = career.leagueListedPlayers.filter((listing) => {
    if (isSameManagerClub(listing.club, career.club)) return false;
    const club = findPlayerLeagueClub(career, listing.playerId);
    return club != null && isSameManagerClub(club, listing.club);
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
