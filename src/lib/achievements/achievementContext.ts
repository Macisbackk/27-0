import { getAllStats } from "../storage/stats";
import { getClubFundsBalance, getClubFundsTotalEarned } from "../storage/club-funds";
import { getUiThemeStoreState } from "../storage/ui-theme-store";
import { UI_THEMES } from "../ui-themes";
import { loadQuizStats } from "../quiz/storage";

/** Snapshot used to evaluate achievement progress and unlock conditions. */
export type AchievementCheckContext = {
  trigger?: string;
  // Season / run
  seasonWins?: number;
  seasonLosses?: number;
  seasonDraws?: number;
  /** Explicit regular-season wins for 29–0 validation (Quick Mode league). */
  regularSeasonWins?: number;
  regularSeasonLosses?: number;
  playoffWins?: number;
  playoffLosses?: number;
  /** True when the run won the Super League title via playoffs. */
  leagueChampion?: boolean;
  /** True for Quick Mode Super League seasons (not cup / WCC / friendlies). */
  quickModeLeagueSeason?: boolean;
  isPerfectSeason?: boolean;
  isUnbeatenSeason?: boolean;
  madePlayoffs?: boolean;
  lowRatedSquad?: boolean;
  squadGrade?: string;
  bradfordPlayerCount?: number;
  winningRecord?: boolean;
  // Match
  matchWon?: boolean;
  marginOfVictory?: number;
  // Challenge cup
  cupPlayed?: boolean;
  cupWon?: boolean;
  cupFinalReached?: boolean;
  eraCup?: boolean;
  beatStrongerTeam?: boolean;
  // Store
  themePurchased?: boolean;
  // Easter eggs
  joeMellorComplete?: boolean;
  superSamComplete?: boolean;
  secretButtonTriggered?: boolean;
  againstTheOddsComplete?: boolean;
  bradfordChallengeComplete?: boolean;
  goatMellorWin?: boolean;
  profileOpened?: boolean;
  /** Daily Challenge — completed both League Leaders + Grand Final. */
  dailyChallengeCompleted?: boolean;
  dailyCurrentStreak?: number;
  dailyBestStreak?: number;
  quizQuestionsAnswered?: number;
  quizQuestionsCorrect?: number;
  quizHighestPrize?: number;
  quizPerfectRun?: boolean;
  quizNoLifelines?: boolean;
  quizTeamCompleted?: boolean;
  quizTeamMillionaire?: boolean;
};

export type AchievementProgressSnapshot = {
  totalWins: number;
  /** Quick Mode wins — used by First Win. */
  quickModeWins: number;
  totalLosses: number;
  totalSeasons: number;
  challengeCupsWon: number;
  storeThemesUnlocked: number;
  totalStoreThemes: number;
  clubFundsBalance: number;
  lifetimeClubFundsEarned: number;
  unbeatenSeasons: number;
  perfectSeasons: number;
  seasonWinsCurrent: number;
  cupFinals: number;
  quizQuestionsAnswered: number;
  quizQuestionsCorrect: number;
};

function sumStatWins(): number {
  const all = getAllStats();
  const buckets = [
    all.normal,
    all.hard,
    all.draftNormal,
    all.draftHard,
    all.eraNormal,
  ];
  return buckets.reduce((sum, s) => sum + (s.seasonWins ?? s.totalWins ?? 0), 0);
}

function sumStatLosses(): number {
  const all = getAllStats();
  const buckets = [
    all.normal,
    all.hard,
    all.draftNormal,
    all.draftHard,
    all.eraNormal,
  ];
  return buckets.reduce(
    (sum, s) => sum + (s.seasonLosses ?? s.totalLosses ?? 0),
    0
  );
}

function sumSeasons(): number {
  const all = getAllStats();
  const buckets = [
    all.normal,
    all.hard,
    all.draftNormal,
    all.draftHard,
    all.eraNormal,
  ];
  return buckets.reduce((sum, s) => sum + (s.totalSeasonsSimulated ?? 0), 0);
}

function sumPerfectSeasons(): number {
  const all = getAllStats();
  const buckets = [
    all.normal,
    all.hard,
    all.draftNormal,
    all.draftHard,
    all.eraNormal,
  ];
  return buckets.reduce((sum, s) => sum + (s.totalPerfectSeasons ?? 0), 0);
}

function sumUnbeatenSeasons(): number {
  const all = getAllStats();
  const buckets = [
    all.normal,
    all.hard,
    all.draftNormal,
    all.draftHard,
    all.eraNormal,
  ];
  return buckets.reduce(
    (sum, s) =>
      sum +
      (typeof s.totalUnbeatenSeasons === "number"
        ? s.totalUnbeatenSeasons
        : 0),
    0
  );
}

/** Build progress from persisted stats plus any session overrides. */
export function buildAchievementProgress(
  ctx: AchievementCheckContext = {}
): AchievementProgressSnapshot {
  const themeStore = getUiThemeStoreState();
  const purchasedThemes = themeStore.unlockedThemeIds.filter(
    (id) => id !== "default"
  );
  const quickModeWins = sumStatWins();
  const quizStats = loadQuizStats();

  return {
    totalWins: quickModeWins,
    quickModeWins,
    totalLosses: sumStatLosses(),
    totalSeasons: sumSeasons(),
    challengeCupsWon: 0,
    storeThemesUnlocked: purchasedThemes.length,
    totalStoreThemes: UI_THEMES.length - 1,
    clubFundsBalance: getClubFundsBalance(),
    lifetimeClubFundsEarned: getClubFundsTotalEarned(),
    unbeatenSeasons: sumUnbeatenSeasons(),
    perfectSeasons: sumPerfectSeasons(),
    seasonWinsCurrent: ctx.seasonWins ?? 0,
    cupFinals: 0,
    quizQuestionsAnswered:
      quizStats.questionsCorrect + quizStats.questionsIncorrect,
    quizQuestionsCorrect: quizStats.questionsCorrect,
  };
}

export function buildBaseAchievementContext(): AchievementCheckContext {
  return { profileOpened: true };
}
