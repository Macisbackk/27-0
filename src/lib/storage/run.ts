import type { CupRunRankingResult, GameDifficulty, RunState } from "../types";
import { computeCupRunRankingResult } from "../cup-run-ranking";
import { getSquadValue } from "../positions";
import { addLeaderboardEntry, getLeaderboardAsync } from "./leaderboard";
import {
  getAllCupLeaderboardProfiles,
  updateCupLeaderboardProfile,
} from "./cup-leaderboard";
import { getChallengeCupPersonalBests } from "../stats-views";
import { isLoggedIn } from "../auth-session";
import { getUsername } from "./user";
import {
  getAllStats,
  resolveStatsBucket,
  updateRerollStats,
  updateSeasonLifetimeStats,
  updateStats,
} from "./stats";
import { gameModeToDbMode } from "./leaderboard";

export interface CompletedRunResult {
  cupRanking?: CupRunRankingResult;
  nationalRank?: number;
  submittedOnline: boolean;
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
  const loggedIn = isLoggedIn();
  const isHiddenRun = options?.joeMellorMode === true;
  const statsBucket = resolveStatsBucket(run.mode, difficulty);

  if (!isHiddenRun) {
    updateStats(signedIds, totalValue, difficulty, new Date(), statsBucket);

    if (difficulty === "NORMAL" && run.mode === "CLASSIC") {
      updateRerollStats(options?.rerollsUsed ?? 0, difficulty, statsBucket);
    }
  }

  const hasSeasonData =
    isCupRun ||
    (options?.seasonWins !== undefined &&
      options?.seasonLosses !== undefined &&
      options?.seasonLeaguePosition !== undefined);

  let nationalRank: number | undefined;

  if (loggedIn && !isHiddenRun) {
    await addLeaderboardEntry(totalValue, run.mode, difficulty, {
      wins,
      losses,
      isPerfectSeason: options?.isPerfectSeason,
      cupWon: options?.cupWon,
      cupFinish: options?.cupFinish,
    });
    if (!isCupRun) {
      const dbMode = gameModeToDbMode(run.mode);
      nationalRank = (
        await getLeaderboardAsync("ALL_TIME", difficulty, 50, dbMode)
      ).rows.find((e) => e.isCurrentUser)?.rank;
    }
  }

  if (hasSeasonData) {
    if (isCupRun) {
      const username = getUsername() ?? "Guest";
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
        difficulty,
        statsBucket
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
        submittedOnline: loggedIn && !isHiddenRun,
        cupRanking: loggedIn && !isHiddenRun
          ? computeCupRunRankingResult(
              username,
              beforeBests,
              afterBests,
              profilesBefore,
              profilesAfter
            )
          : undefined,
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
      difficulty,
      statsBucket
    );
  }

  return { nationalRank, submittedOnline: loggedIn && !isHiddenRun };
}
