import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getPlayerById } from "../players";
import { syncPlayerValueFromRating } from "../players/ratings";
import type { LeagueTransferActivity, ManagerCareer } from "./types";
import { maybeGenerateAiTransfers } from "./managerAiTransfers";
import { maybeAiSignFreeAgents, addPlayersToFreeAgents } from "./managerFreeAgents";
import { getManagerPlayer, getManagerPlayerAge } from "./managerPlayers";
import {
  getLeagueClubRosterIds,
  reconcileLeagueRosters,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { getProtectedTransferPlayerIds } from "./managerTransferLeague";
import { getLeagueSeasonIndex } from "./managerLeagueSeason";

export { getLeagueSeasonIndex } from "./managerLeagueSeason";

function isAiYouthId(playerId: string): boolean {
  return playerId.startsWith("mgr-ai-");
}

function clubSquadAverage(career: ManagerCareer, club: string): number {
  const ratings = getLeagueClubRosterIds(career, club)
    .map((id) => getManagerPlayer(career, id)?.peakRating ?? 0)
    .filter((r) => r > 0);
  if (ratings.length === 0) return 72;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

/** Accelerate homegrown AI players so they break into senior sides after a few seasons. */
export function matureAiYouthInClub(
  career: ManagerCareer,
  club: string
): ManagerCareer {
  const seasonIndex = getLeagueSeasonIndex(career);
  if (seasonIndex < 1) return career;

  const rng = seedrandom(
    `${career.seed}-ai-mature-${club}-s${career.seasonYear}`
  );
  const playerDevelopment = { ...(career.playerDevelopment ?? {}) };
  const playerRegistry = { ...(career.playerRegistry ?? {}) };
  let changed = false;

  for (const playerId of getLeagueClubRosterIds(career, club)) {
    if (!isAiYouthId(playerId)) continue;

    const player =
      getManagerPlayer(career, playerId) ?? playerRegistry[playerId];
    if (!player) continue;

    const age = getManagerPlayerAge(career, playerId) ?? 20;
    if (age > 27) continue;

    const dev = playerDevelopment[playerId];
    const current = dev?.rating ?? player.peakRating;
    const potential = Math.max(
      dev?.potential ?? player.peakRating + 6,
      current + 2
    );
    if (current >= potential) continue;

    // Stronger annual bumps so AI academies keep pace with retirements.
    const gain =
      age <= 21
        ? 3 + Math.floor(rng() * 3)
        : age <= 24
          ? 2 + Math.floor(rng() * 2)
          : 1 + Math.floor(rng() * 2);
    const after = Math.min(potential, current + gain);
    if (after <= current) continue;

    playerDevelopment[playerId] = {
      ...dev,
      rating: after,
      peakRating: after,
      potential,
      developmentRate: dev?.developmentRate ?? 0.55,
      seasonStartRating: after,
      promotedSeasonYear: dev?.promotedSeasonYear ?? career.seasonYear - 2,
    };
    playerRegistry[playerId] = syncPlayerValueFromRating({
      ...player,
      peakRating: after,
    });
    changed = true;
  }

  if (!changed) return career;
  return { ...career, playerDevelopment, playerRegistry };
}

/**
 * Light season-start prune — only ageing or clearly surplus depth.
 * Heavier fringe releases already run via contract expiries.
 */
export function releaseSurplusAiPlayers(
  career: ManagerCareer,
  club: string
): ManagerCareer {
  const seasonIndex = getLeagueSeasonIndex(career);
  const releaseCount = Math.min(2, 1 + Math.floor(seasonIndex / 3));
  if (releaseCount <= 0) return career;

  const rng = seedrandom(
    `${career.seed}-ai-prune-${club}-s${career.seasonYear}`
  );
  const protectedIds = getProtectedTransferPlayerIds(career, club);
  const roster = getLeagueClubRosterIds(career, club);
  const ratingCap = 72 + Math.min(4, Math.floor(seasonIndex / 2));

  const candidates = roster
    .filter((id) => !protectedIds.has(id))
    .map((id) => {
      const player = getManagerPlayer(career, id) ?? getPlayerById(id);
      const age = getManagerPlayerAge(career, id) ?? 26;
      const rating = player?.peakRating ?? 70;
      return { id, rating, age, youth: isAiYouthId(id) };
    })
    .filter((row) => row.age >= 33 || (row.rating < ratingCap && !row.youth))
    .sort((a, b) => {
      const scoreA = a.rating - (a.youth ? 8 : 0) + a.age * 0.15;
      const scoreB = b.rating - (b.youth ? 8 : 0) + b.age * 0.15;
      return scoreA - scoreB;
    });

  const toRelease = candidates.slice(0, releaseCount);
  if (toRelease.length === 0) return career;

  const shuffled = [...toRelease].sort(() => rng() - 0.5);
  const picks = shuffled.slice(
    0,
    Math.min(releaseCount, 1 + Math.floor(rng() * releaseCount))
  );

  return addPlayersToFreeAgents(
    career,
    picks.map((row) => ({ playerId: row.id, formerClub: club })),
    career.seasonYear
  );
}

/**
 * Targeted free-agent signing for one AI club.
 * Accepts near-parity fills (upgrade >= -3) so squads replace leavers, not only upgrades.
 */
export function aiClubSignBestFreeAgent(
  career: ManagerCareer,
  club: string,
  minUpgrade = -3
): ManagerCareer {
  const rosterIds = new Set(getLeagueClubRosterIds(career, club));
  const pool = (career.freeAgents ?? []).filter((agent) => {
    const owner = career.squad.some((s) => s.playerId === agent.playerId);
    return !owner && !rosterIds.has(agent.playerId);
  });
  if (pool.length === 0) return career;

  const squadAvg = clubSquadAverage(career, club);

  const candidates = pool
    .map((agent) => {
      const player =
        getManagerPlayer(career, agent.playerId) ??
        getPlayerById(agent.playerId);
      if (!player) return null;
      return {
        agent,
        player,
        rating: player.peakRating,
        upgrade: player.peakRating - squadAvg,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row != null && row.upgrade >= minUpgrade
    )
    .sort((a, b) => b.upgrade - a.upgrade || b.rating - a.rating);

  const pick = candidates[0];
  if (!pick) return career;

  const activity: LeagueTransferActivity = {
    id: `fa-ai-pre-${career.seasonYear}-${club}-${pick.agent.playerId}`,
    week: 0,
    fromClub: pick.agent.formerClub,
    toClub: club,
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
      leagueTransfers: [activity, ...(career.leagueTransfers ?? [])].slice(0, 32),
    },
    pick.agent.playerId,
    pick.agent.formerClub,
    club
  );
}

/**
 * Season-start roster churn for AI clubs: youth maturation, light releases,
 * multiple FA replacements, and a transfer burst.
 */
export function simulateAiSeasonRosterActivity(
  career: ManagerCareer
): ManagerCareer {
  const seasonIndex = getLeagueSeasonIndex(career);
  let next = career;

  // Sign more than we prune so averages do not drift down over seasons.
  const signsPerClub = Math.min(3, 1 + Math.floor((seasonIndex + 1) / 2));

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === next.club) continue;
    next = matureAiYouthInClub(next, club);
    next = releaseSurplusAiPlayers(next, club);
    for (let i = 0; i < signsPerClub; i++) {
      next = aiClubSignBestFreeAgent(next, club);
    }
  }

  next = reconcileLeagueRosters(next);

  const transferBursts = Math.min(10, 4 + seasonIndex);
  for (let i = 0; i < transferBursts; i++) {
    next = maybeGenerateAiTransfers(next);
    next = maybeAiSignFreeAgents(next);
  }

  return next;
}
