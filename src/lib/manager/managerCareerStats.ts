import type { MatchFixture } from "../game/season-simulation";
import type { SquadSlot } from "../types";
import type { ManagerCareer, ManagerPlayerSeasonStats, ManagerTeamSeasonStats } from "./types";

export const EMPTY_TEAM_SEASON_STATS: ManagerTeamSeasonStats = {
  played: 0,
  wins: 0,
  losses: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  pointsDifference: 0,
  triesFor: 0,
  triesAgainst: 0,
  leaguePoints: 0,
};

export function createEmptyPlayerSeasonStats(
  playerId: string
): ManagerPlayerSeasonStats {
  return {
    playerId,
    appearances: 0,
    tries: 0,
    goals: 0,
    playerOfMatch: 0,
  };
}

export function getOrCreatePlayerStats(
  map: Record<string, ManagerPlayerSeasonStats>,
  playerId: string
): ManagerPlayerSeasonStats {
  if (!map[playerId]) {
    map[playerId] = createEmptyPlayerSeasonStats(playerId);
  }
  return map[playerId]!;
}

export function buildRecentForm(
  fixtures: MatchFixture[],
  limit = 5
): string[] {
  return fixtures.slice(-limit).map((f) => f.result);
}

export function computeSquadForm(career: ManagerCareer): number {
  if (career.squad.length === 0) return 50;
  const sum = career.squad.reduce((a, p) => a + p.form, 0);
  return Math.round(sum / career.squad.length);
}

export function computeSquadFitness(career: ManagerCareer): number {
  if (career.squad.length === 0) return 100;
  const sum = career.squad.reduce((a, p) => a + p.fitness, 0);
  return Math.round(sum / career.squad.length);
}

export function formLabel(score: number): string {
  if (score >= 75) return "In form";
  if (score >= 60) return "Good";
  if (score >= 45) return "Average";
  if (score >= 30) return "Struggling";
  return "Out of form";
}

export function updateStatsAfterMatch(
  career: ManagerCareer,
  fixture: MatchFixture,
  squad: SquadSlot[],
  xiiiIds: string[],
  motmPlayerId?: string | null
): {
  teamSeasonStats: ManagerTeamSeasonStats;
  playerSeasonStats: Record<string, ManagerPlayerSeasonStats>;
  recentForm: string[];
} {
  const won = fixture.result === "W";
  const teamSeasonStats: ManagerTeamSeasonStats = {
    played: career.teamSeasonStats.played + 1,
    wins: career.teamSeasonStats.wins + (won ? 1 : 0),
    losses: career.teamSeasonStats.losses + (won ? 0 : 1),
    pointsFor: career.teamSeasonStats.pointsFor + fixture.pointsFor,
    pointsAgainst: career.teamSeasonStats.pointsAgainst + fixture.pointsAgainst,
    pointsDifference:
      career.teamSeasonStats.pointsFor +
      fixture.pointsFor -
      (career.teamSeasonStats.pointsAgainst + fixture.pointsAgainst),
    triesFor: career.teamSeasonStats.triesFor + fixture.triesFor,
    triesAgainst: career.teamSeasonStats.triesAgainst + fixture.triesAgainst,
    leaguePoints: career.teamSeasonStats.leaguePoints + (won ? 2 : 0),
  };

  const playerSeasonStats = { ...career.playerSeasonStats };
  const userScorers = fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
  const kicking = fixture.scoringDetail?.dreamTeam.kicking;

  for (const id of xiiiIds) {
    const stats = getOrCreatePlayerStats(playerSeasonStats, id);
    stats.appearances += 1;
  }

  for (const scorer of userScorers) {
    const stats = getOrCreatePlayerStats(playerSeasonStats, scorer.playerId);
    stats.tries += scorer.tries;
  }

  if (kicking?.playerId) {
    const stats = getOrCreatePlayerStats(playerSeasonStats, kicking.playerId);
    stats.goals += kicking.conversions + kicking.penalties;
  }

  if (motmPlayerId) {
    const stats = getOrCreatePlayerStats(playerSeasonStats, motmPlayerId);
    stats.playerOfMatch += 1;
  }

  const recentForm = buildRecentForm([...career.fixtures, fixture]);

  return { teamSeasonStats, playerSeasonStats, recentForm };
}

export function getTopTryScorer(
  stats: Record<string, ManagerPlayerSeasonStats>
): { playerId: string; tries: number } | null {
  let best: { playerId: string; tries: number } | null = null;
  for (const s of Object.values(stats)) {
    if (!best || s.tries > best.tries) {
      best = { playerId: s.playerId, tries: s.tries };
    }
  }
  return best && best.tries > 0 ? best : null;
}

export function getTopGoalScorer(
  stats: Record<string, ManagerPlayerSeasonStats>
): { playerId: string; goals: number } | null {
  let best: { playerId: string; goals: number } | null = null;
  for (const s of Object.values(stats)) {
    if (!best || s.goals > best.goals) {
      best = { playerId: s.playerId, goals: s.goals };
    }
  }
  return best && best.goals > 0 ? best : null;
}
