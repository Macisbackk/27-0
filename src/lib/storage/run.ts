import type { CupRunRankingResult, GameDifficulty, RunState } from "../types";
import { computeCupRunRankingResult } from "../cup-run-ranking";
import { getSquadValue } from "../positions";
import { addLeaderboardEntry, getLeaderboard } from "./leaderboard";
import {
  getAllCupLeaderboardProfiles,
  updateCupLeaderboardProfile,
} from "./cup-leaderboard";
import { getChallengeCupPersonalBests } from "../stats-views";
import { getUsername } from "./user";
import {
  getAllStats,
  updateRerollStats,
  updateSeasonLifetimeStats,
  updateStats,
} from "./stats";

export function recordCompletedRun(
  run: RunState,
  signedIds: string[],
  difficulty: GameDifficulty = "NORMAL",
  options?: {
    joeMellorMode?: boolean;
    seasonWins?: number;
    seasonLosses?: number;
    seasonLeaguePosition?: number;
    isPerfectSeason?: boolean;
    longestWinStreak?: number;
    longestLosingStreak?: number;
    rerollsUsed?: number;
    challengeCupMode?: boolean;
    cupFinish?: string;
    cupWon?: boolean;
    averageSquadRating?: number;
    matchResults?: ("W" | "L")[];
  }
): CupRunRankingResult | undefined {
  const totalValue = run.totalValue || getSquadValue(run.squad);
  const isCupRun = options?.challengeCupMode === true;

  if (!isCupRun) {
    addLeaderboardEntry(totalValue, run.mode, difficulty);
  }

  const nationalRank = isCupRun
    ? undefined
    : getLeaderboard("ALL_TIME", difficulty).find((e) => e.isCurrentUser)?.rank;

  updateStats(signedIds, totalValue, difficulty);

  if (difficulty === "NORMAL") {
    updateRerollStats(options?.rerollsUsed ?? 0, difficulty);
  }

  if (
    isCupRun ||
    (options?.seasonWins !== undefined &&
      options?.seasonLosses !== undefined &&
      options?.seasonLeaguePosition !== undefined)
  ) {
    if (isCupRun) {
      const username = getUsername();
      const storedBefore = getAllStats();
      const beforeBests = getChallengeCupPersonalBests(
        storedBefore.normal,
        storedBefore.hard
      );
      const profilesBefore = getAllCupLeaderboardProfiles();

      updateSeasonLifetimeStats(
        {
          wins: options.seasonWins ?? 0,
          losses: options.seasonLosses ?? 0,
          leaguePosition: options.seasonLeaguePosition ?? 1,
          isPerfect: options.isPerfectSeason ?? false,
          longestWinStreak: options.longestWinStreak ?? 0,
          longestLosingStreak: options.longestLosingStreak ?? 0,
          signedIds,
          totalValue,
          nationalRank,
          joeMellorMode: options.joeMellorMode,
          challengeCupMode: true,
          cupFinish: options.cupFinish,
          cupWon: options.cupWon,
          averageSquadRating: options.averageSquadRating,
          matchResults: options.matchResults ?? [],
        },
        difficulty
      );

      updateCupLeaderboardProfile(
        {
          wins: options.seasonWins ?? 0,
          losses: options.seasonLosses ?? 0,
          cupWon: options.cupWon ?? false,
          cupFinish: options.cupFinish,
          matchResults: options.matchResults ?? [],
        },
        username
      );

      const storedAfter = getAllStats();
      const afterBests = getChallengeCupPersonalBests(
        storedAfter.normal,
        storedAfter.hard
      );
      const profilesAfter = getAllCupLeaderboardProfiles();

      return computeCupRunRankingResult(
        username,
        beforeBests,
        afterBests,
        profilesBefore,
        profilesAfter
      );
    }

    updateSeasonLifetimeStats(
      {
        wins: options.seasonWins ?? 0,
        losses: options.seasonLosses ?? 0,
        leaguePosition: options.seasonLeaguePosition ?? 1,
        isPerfect: options.isPerfectSeason ?? false,
        longestWinStreak: options.longestWinStreak ?? 0,
        longestLosingStreak: options.longestLosingStreak ?? 0,
        signedIds,
        totalValue,
        nationalRank,
        joeMellorMode: options.joeMellorMode,
        challengeCupMode: options.challengeCupMode,
        cupFinish: options.cupFinish,
        cupWon: options.cupWon,
        averageSquadRating: options.averageSquadRating,
      },
      difficulty
    );
  }

  return undefined;
}
