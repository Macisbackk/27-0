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

/** Accelerate homegrown AI players so they break into senior sides after a few seasons. */
export function matureAiYouthInClub(
  career: ManagerCareer,
  club: string
): ManagerCareer {
  const seasonIndex = getLeagueSeasonIndex(career);
  if (seasonIndex < 2) return career;

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

    const gain =
      age <= 21
        ? 2 + Math.floor(rng() * 2)
        : age <= 24
          ? 1 + Math.floor(rng() * 2)
          : 1;
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

/** Release ageing or surplus AI squad players to create turnover and list space. */
export function releaseSurplusAiPlayers(
  career: ManagerCareer,
  club: string
): ManagerCareer {
  const seasonIndex = getLeagueSeasonIndex(career);
  const releaseCount = Math.min(3, 1 + Math.floor(seasonIndex / 2));
  if (releaseCount <= 0) return career;

  const rng = seedrandom(
    `${career.seed}-ai-prune-${club}-s${career.seasonYear}`
  );
  const protectedIds = getProtectedTransferPlayerIds(career, club);
  const roster = getLeagueClubRosterIds(career, club);
  const ratingCap = 78 + Math.min(8, seasonIndex);

  const candidates = roster
    .filter((id) => !protectedIds.has(id))
    .map((id) => {
      const player = getManagerPlayer(career, id) ?? getPlayerById(id);
      const age = getManagerPlayerAge(career, id) ?? 26;
      const rating = player?.peakRating ?? 70;
      return { id, rating, age, youth: isAiYouthId(id) };
    })
    .filter((row) => row.rating < ratingCap || row.age >= 32)
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

/** Targeted upgrade signings from the free-agent pool at season start. */
function aiClubSignBestFreeAgent(
  career: ManagerCareer,
  club: string
): ManagerCareer {
  const pool = (career.freeAgents ?? []).filter((agent) => {
    const owner = career.squad.some((s) => s.playerId === agent.playerId);
    return !owner && !getLeagueClubRosterIds(career, club).includes(agent.playerId);
  });
  if (pool.length === 0) return career;

  const rosterRatings = getLeagueClubRosterIds(career, club)
    .map((id) => getManagerPlayer(career, id)?.peakRating ?? 0)
    .filter((r) => r > 0);
  const squadAvg =
    rosterRatings.length > 0
      ? rosterRatings.reduce((a, b) => a + b, 0) / rosterRatings.length
      : 72;

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
    .filter((row): row is NonNullable<typeof row> => row != null && row.upgrade >= -2)
    .sort((a, b) => b.upgrade - a.upgrade || b.rating - a.rating);

  const pick = candidates[0];
  if (!pick || pick.upgrade < 0) return career;

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
 * Season-start roster churn for AI clubs: youth maturation, releases, and a transfer burst.
 */
export function simulateAiSeasonRosterActivity(
  career: ManagerCareer
): ManagerCareer {
  const seasonIndex = getLeagueSeasonIndex(career);
  let next = career;

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    if (club === next.club) continue;
    next = matureAiYouthInClub(next, club);
    next = releaseSurplusAiPlayers(next, club);
    if (seasonIndex >= 1) {
      next = aiClubSignBestFreeAgent(next, club);
    }
  }

  next = reconcileLeagueRosters(next);

  const transferBursts = Math.min(6, 2 + Math.floor(seasonIndex / 2));
  for (let i = 0; i < transferBursts; i++) {
    next = maybeGenerateAiTransfers(next);
    next = maybeAiSignFreeAgents(next);
  }

  return next;
}
