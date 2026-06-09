import type { CupRunRankingResult, GameDifficulty, RunState } from "../types";
import { computeCupRunRankingResult } from "../cup-run-ranking";
import { getSquadValue } from "../positions";
import { addLeaderboardEntry, getLeaderboardAsync } from "./leaderboard";
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

export interface CompletedRunResult {
  cupRanking?: CupRunRankingResult;
  nationalRank?: number;
}

export async function recordCompletedRun(
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
): Promise<CompletedRunResult> {
  const totalValue = run.totalValue || getSquadValue(run.squad);
  const isCupRun = options?.challengeCupMode === true;
  const wins = options?.seasonWins ?? 0;
  const losses = options?.seasonLosses ?? 0;

  await addLeaderboardEntry(totalValue, run.mode, difficulty, { wins, losses });

  const nationalRank = isCupRun
    ? undefined
    : (
        await getLeaderboardAsync("ALL_TIME", difficulty, 50, "super-league")
      ).rows.find((e) => e.isCurrentUser)?.rank;

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
          wins,
          losses,
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
          wins,
          losses,
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

      return {
        cupRanking: computeCupRunRankingResult(
          username,
          beforeBests,
          afterBests,
          profilesBefore,
          profilesAfter
        ),
      };
    }

    updateSeasonLifetimeStats(
      {
        wins,
        losses,
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

  return { nationalRank };
}
