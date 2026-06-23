import type { CupRunRankingResult, GameDifficulty, RunState } from "../types";
import { computeCupRunRankingResult } from "../cup-run-ranking";
import { getSquadValue } from "../positions";
import { resolveClassicModeVariant } from "../mode-variant";
import { addLeaderboardEntry, getLeaderboardAsync } from "./leaderboard";
import {
  getAllCupLeaderboardProfiles,
  updateCupLeaderboardProfile,
  updateEraCupLeaderboardProfile,
} from "./cup-leaderboard";
import { getChallengeCupPersonalBests } from "../stats-views";
import { isLoggedIn } from "../auth-session";
import { getUsername } from "./user";
import {
  getAllStats,
  resolveStatsBucket,
  updatePlayoffLifetimeStats,
  updateRerollStats,
  updateSeasonLifetimeStats,
  updateStats,
} from "./stats";
import { gameModeToDbMode } from "./leaderboard";
import { recordCupTeamWin, recordEraCupTeamWin } from "./cup-team-wins";

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
    superSamHallasMode?: boolean;
    normalEraMode?: boolean;
    modeVariant?: import("../types").ModeVariant;
    seasonWins?: number;
    seasonLosses?: number;
    seasonLeaguePosition?: number;
    isPerfectSeason?: boolean;
    longestWinStreak?: number;
    longestLosingStreak?: number;
    rerollsUsed?: number;
    challengeCupMode?: boolean;
    eraChallengeCupMode?: boolean;
    eraTeamUsed?: string;
    cupFinish?: string;
    cupWon?: boolean;
    averageSquadRating?: number;
    matchResults?: ("W" | "L")[];
    cupTeam?: string;
    eraCupWinner?: string;
    playoffWins?: number;
    playoffLosses?: number;
    playoffFinish?: string;
    superLeagueTitle?: boolean;
    topSixFinish?: boolean;
  }
): Promise<CompletedRunResult> {
  const totalValue = run.totalValue || getSquadValue(run.squad);
  const isEraCupRun = options?.eraChallengeCupMode === true;
  const isCupRun = options?.challengeCupMode === true;
  const regularWins = options?.seasonWins ?? 0;
  const regularLosses = options?.seasonLosses ?? 0;
  const playoffWins = options?.playoffWins ?? 0;
  const playoffLosses = options?.playoffLosses ?? 0;
  const wins = regularWins + playoffWins;
  const losses = regularLosses + playoffLosses;
  const loggedIn = isLoggedIn();
  const isHiddenRun =
    options?.joeMellorMode === true || options?.superSamHallasMode === true;
  const modeVariant = resolveClassicModeVariant({
    modeVariant: run.modeVariant,
    normalEraMode: options?.normalEraMode,
  });
  const statsBucket = resolveStatsBucket(run.mode, difficulty, modeVariant);

  if (!isHiddenRun) {
    updateStats(signedIds, totalValue, difficulty, new Date(), statsBucket);

    if (difficulty === "NORMAL" && run.mode === "CLASSIC") {
      updateRerollStats(options?.rerollsUsed ?? 0, difficulty, statsBucket);
    }
  }

  const hasSeasonData =
    isCupRun ||
    isEraCupRun ||
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
      modeVariant: isEraCupRun ? "era" : modeVariant,
    });
    if (!isCupRun && !isEraCupRun) {
      const dbMode = gameModeToDbMode(run.mode);
      nationalRank = (
        await getLeaderboardAsync(
          "ALL_TIME",
          difficulty,
          50,
          dbMode,
          modeVariant
        )
      ).rows.find((e) => e.isCurrentUser)?.rank;
    }
  }

  if (hasSeasonData) {
    if (isEraCupRun) {
      const username = getUsername() ?? "Guest";

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
          eraChallengeCupMode: true,
          cupFinish: options.cupFinish,
          cupWon: options.cupWon,
          averageSquadRating: options.averageSquadRating,
          matchResults: options.matchResults ?? [],
          eraTeamUsed: options.eraTeamUsed,
        },
        difficulty,
        statsBucket
      );

      updateEraCupLeaderboardProfile(
        {
          wins,
          losses,
          cupWon: options.cupWon ?? false,
          cupFinish: options.cupFinish,
          matchResults: options.matchResults ?? [],
        },
        username
      );

      if (options.eraCupWinner) {
        recordEraCupTeamWin(options.eraCupWinner);
      }

      return { submittedOnline: loggedIn && !isHiddenRun };
    }

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
          superSamHallasMode: options.superSamHallasMode,
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

      if (options.cupWon && options.cupTeam) {
        recordCupTeamWin(options.cupTeam);
      }

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
        wins: regularWins,
        losses: regularLosses,
        leaguePosition: options.seasonLeaguePosition ?? 1,
        isPerfect: options.isPerfectSeason ?? false,
        longestWinStreak: options.longestWinStreak ?? 0,
        longestLosingStreak: options.longestLosingStreak ?? 0,
        signedIds,
        totalValue,
        nationalRank,
        joeMellorMode: options.joeMellorMode,
        superSamHallasMode: options.superSamHallasMode,
        challengeCupMode: options.challengeCupMode,
        cupFinish: options.cupFinish,
        cupWon: options.cupWon,
        averageSquadRating: options.averageSquadRating,
        playoffWins,
        playoffLosses,
        playoffFinish: options.playoffFinish,
        superLeagueTitle: options.superLeagueTitle,
        topSixFinish: options.topSixFinish,
      },
      difficulty,
      statsBucket
    );
  }

  return { nationalRank, submittedOnline: loggedIn && !isHiddenRun };
}

export async function recordPlayoffCompletion(
  run: RunState,
  signedIds: string[],
  difficulty: GameDifficulty = "NORMAL",
  options: {
    regularWins: number;
    regularLosses: number;
    playoffWins: number;
    playoffLosses: number;
    seasonLeaguePosition: number;
    playoffFinish?: string;
    superLeagueTitle?: boolean;
  }
): Promise<CompletedRunResult> {
  const totalValue = run.totalValue || getSquadValue(run.squad);
  const loggedIn = isLoggedIn();
  const modeVariant = resolveClassicModeVariant({ modeVariant: run.modeVariant });
  const statsBucket = resolveStatsBucket(run.mode, difficulty, modeVariant);
  const wins = options.regularWins + options.playoffWins;
  const losses = options.regularLosses + options.playoffLosses;

  updatePlayoffLifetimeStats(
    {
      regularWins: options.regularWins,
      regularLosses: options.regularLosses,
      playoffWins: options.playoffWins,
      playoffLosses: options.playoffLosses,
      playoffFinish: options.playoffFinish,
      superLeagueTitle: options.superLeagueTitle,
      signedIds,
    },
    difficulty,
    statsBucket
  );

  let nationalRank: number | undefined;
  if (loggedIn && run.mode === "CLASSIC") {
    await addLeaderboardEntry(totalValue, run.mode, difficulty, {
      wins,
      losses,
      modeVariant,
    });
    const dbMode = gameModeToDbMode(run.mode);
    nationalRank = (
      await getLeaderboardAsync(
        "ALL_TIME",
        difficulty,
        50,
        dbMode,
        modeVariant
      )
    ).rows.find((e) => e.isCurrentUser)?.rank;
  }

  return { nationalRank, submittedOnline: loggedIn };
}
