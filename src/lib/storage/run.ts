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
} from "./stats";
import { updateStats } from "./stats-update";
import { gameModeToDbMode } from "./leaderboard";
import { syncTrophyCabinetLeaderboard } from "./trophy-cabinet-leaderboard";
import { recordDailyChallengeRunResult } from "../daily-challenge";

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
    /** Optional boost metadata (no longer excludes competitive leaderboards). */
    usedBoosts?: boolean;
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
    /** Daily Challenge runs stay off the Classic Quick leaderboard. */
    dailyChallengeMode?: boolean;
    /** Weekly Challenge runs: own board (storage/weekly-leaderboard.ts), treated like the Daily here. */
    weeklyChallengeMode?: boolean;
  }
): Promise<CompletedRunResult> {
  const totalValue = run.totalValue || getSquadValue(run.squad);
  if (options?.dailyChallengeMode && options.seasonLeaguePosition !== undefined) {
    // Daily streak + Daily score: only the day's counted attempt counts (checked inside).
    recordDailyChallengeRunResult({
      runId: run.id,
      phase: "regular",
      regularWins: options.seasonWins ?? 0,
      leaguePosition: options.seasonLeaguePosition,
    });
  }
  const regularWins = options?.seasonWins ?? 0;
  const regularLosses = options?.seasonLosses ?? 0;
  const playoffWins = options?.playoffWins ?? 0;
  const playoffLosses = options?.playoffLosses ?? 0;
  const wins = regularWins + playoffWins;
  const losses = regularLosses + playoffLosses;
  const loggedIn = isLoggedIn();
  const isHiddenRun =
    options?.joeMellorMode === true || options?.superSamHallasMode === true;
  const isDailyChallenge =
    options?.dailyChallengeMode === true || options?.weeklyChallengeMode === true;
  // Ball Knower (HARD) still counts towards lifetime stats but, like the Daily, is never
  // ranked: no leaderboard row and no trophy-cabinet sync.
  const isBallKnower = difficulty === "HARD";
  // Boosts remain tracked via usedBoosts metadata but no longer exclude competitive entry.
  // Daily Challenge stays off Classic LB and must not pollute Normal/Era lifetime stats.
  const excludeFromLeaderboard = isHiddenRun || isDailyChallenge || isBallKnower;
  const modeVariant = resolveClassicModeVariant({
    modeVariant: run.modeVariant,
    normalEraMode: options?.normalEraMode,
  });
  const statsBucket = resolveStatsBucket(run.mode, difficulty, modeVariant);

  if (!isHiddenRun && !isDailyChallenge) {
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

  if (loggedIn && !excludeFromLeaderboard) {
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

  if (hasSeasonData && !isDailyChallenge) {
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

  if (!excludeFromLeaderboard && hasSeasonData) syncTrophyCabinetLeaderboard();
  return {
    nationalRank,
    submittedOnline: loggedIn && !excludeFromLeaderboard,
  };
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
    usedBoosts?: boolean;
    /** Daily Challenge runs stay off the Classic Quick leaderboard. */
    dailyChallengeMode?: boolean;
    /** Weekly Challenge runs: own board (storage/weekly-leaderboard.ts), treated like the Daily here. */
    weeklyChallengeMode?: boolean;
  }
): Promise<CompletedRunResult> {
  const totalValue = run.totalValue || getSquadValue(run.squad);
  if (options.dailyChallengeMode) {
    recordDailyChallengeRunResult({
      runId: run.id,
      phase: "playoff",
      regularWins: options.regularWins,
      leaguePosition: options.seasonLeaguePosition,
      playoffWins: options.playoffWins,
      grandFinal:
        options.superLeagueTitle === true || options.playoffFinish === "Super League Champions",
    });
  }
  const loggedIn = isLoggedIn();
  const modeVariant = resolveClassicModeVariant({ modeVariant: run.modeVariant });
  const statsBucket = resolveStatsBucket(run.mode, difficulty, modeVariant);
  const isDailyChallenge =
    options.dailyChallengeMode === true || options.weeklyChallengeMode === true;
  // Ball Knower (HARD): lifetime stats yes, leaderboard / trophy board no (mirrors the Daily).
  const isBallKnower = difficulty === "HARD";
  const excludeFromLeaderboard = isDailyChallenge || isBallKnower;

  const superLeagueTitle =
    options.superLeagueTitle ??
    options.playoffFinish === "Super League Champions";

  if (!isDailyChallenge) {
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
  }

  let nationalRank: number | undefined;
  if (loggedIn && run.mode === "CLASSIC" && !excludeFromLeaderboard) {
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

  if (!excludeFromLeaderboard) syncTrophyCabinetLeaderboard();
  return {
    nationalRank,
    submittedOnline: loggedIn && !excludeFromLeaderboard,
  };
}
