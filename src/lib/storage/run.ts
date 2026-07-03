import type { GameDifficulty, RunState } from "../types";
import { getSquadValue } from "../positions";
import { resolveClassicModeVariant } from "../mode-variant";
import { addLeaderboardEntry, getLeaderboardAsync } from "./leaderboard";
import { isLoggedIn } from "../auth-session";
import {
  resolveStatsBucket,
  updatePlayoffLifetimeStats,
  updateRerollStats,
  updateSeasonLifetimeStats,
  updateStats,
} from "./stats";
import { gameModeToDbMode } from "./leaderboard";
import { syncTrophyCabinetLeaderboard } from "./trophy-cabinet-leaderboard";

export interface CompletedRunResult {
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
    averageSquadRating?: number;
    playoffWins?: number;
    playoffLosses?: number;
    playoffFinish?: string;
    superLeagueTitle?: boolean;
    topSixFinish?: boolean;
  }
): Promise<CompletedRunResult> {
  const totalValue = run.totalValue || getSquadValue(run.squad);
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
    options?.seasonWins !== undefined &&
    options?.seasonLosses !== undefined &&
    options?.seasonLeaguePosition !== undefined;

  let nationalRank: number | undefined;

  if (loggedIn && !isHiddenRun) {
    await addLeaderboardEntry(totalValue, run.mode, difficulty, {
      wins,
      losses,
      isPerfectSeason: options?.isPerfectSeason,
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

  if (hasSeasonData) {
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
        averageSquadRating: options.averageSquadRating,
        playoffWins,
        playoffLosses,
        playoffFinish: options.playoffFinish,
        topSixFinish: options.topSixFinish,
      },
      difficulty,
      statsBucket
    );
  }

  if (!isHiddenRun && hasSeasonData) syncTrophyCabinetLeaderboard();
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

  const superLeagueTitle =
    options.superLeagueTitle ??
    options.playoffFinish === "Super League Champions";

  updatePlayoffLifetimeStats(
    {
      regularWins: options.regularWins,
      regularLosses: options.regularLosses,
      playoffWins: options.playoffWins,
      playoffLosses: options.playoffLosses,
      playoffFinish: options.playoffFinish,
      superLeagueTitle,
      signedIds,
    },
    difficulty,
    statsBucket
  );

  let nationalRank: number | undefined;
  if (loggedIn && run.mode === "CLASSIC") {
    await addLeaderboardEntry(totalValue, run.mode, difficulty, {
      wins: options.playoffWins,
      losses: options.playoffLosses,
      modeVariant,
      isPlayoffPhaseUpdate: true,
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

  syncTrophyCabinetLeaderboard();
  return { nationalRank, submittedOnline: loggedIn };
}
