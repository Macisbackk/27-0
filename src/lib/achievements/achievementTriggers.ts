import type { MatchFixture } from "../game/season-simulation";
import type { CareerLegacy, CareerState, SeasonOutcome } from "../career/types";
import { getSeasonGradeFromSquad } from "../grades";
import { getSquadValue } from "../positions";
import type { SquadSlot } from "../types";
import type { AchievementCheckContext } from "./achievementContext";
import { dispatchAchievementCheck } from "./achievementNotify";

function countBradfordPlayers(squad: SquadSlot[]): number {
  return squad.filter((slot) => {
    const club = slot.player?.club ?? slot.player?.displayClub ?? "";
    return club.toLowerCase().includes("bradford");
  }).length;
}

export function triggerAchievementCheck(ctx: AchievementCheckContext): void {
  dispatchAchievementCheck(ctx);
}

export function triggerQuickMatchAchievements(fixture: MatchFixture): void {
  const won = fixture.result === "W";
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  triggerAchievementCheck({
    trigger: "quick-match-completed",
    matchWon: won,
    marginOfVictory: won ? margin : undefined,
  });
}

export function triggerQuickSeasonAchievements(
  squad: SquadSlot[],
  season: {
    wins: number;
    losses: number;
    draws?: number;
    leaguePosition: number;
    pointsDifference: number;
    isPerfect: boolean;
    squadStrength: number;
    fixtures: MatchFixture[];
  },
  options: {
    joeMellorMode?: boolean;
    superSamHallasMode?: boolean;
    normalEraMode?: boolean;
    dailyChallengeMode?: boolean;
    madePlayoffs?: boolean;
    playoffWins?: number;
    playoffLosses?: number;
    leagueChampion?: boolean;
  } = {}
): void {
  // Daily Challenge has its own streak achievements — do not credit Normal Mode.
  if (options.dailyChallengeMode) {
    return;
  }

  // Super Sam Hallas: joke undefeated run — only the play-mode EE unlocks.
  // Do not credit Normal Mode win / perfect-season / grade achievements.
  if (options.superSamHallasMode) {
    triggerAchievementCheck({
      trigger: "quick-season-completed",
      superSamComplete: true,
      againstTheOddsComplete: true,
    });
    return;
  }

  // Joe Mellor GOAT Mode: distinct EEs only (no Normal Mode win credits).
  // goat-status = play the mode; mellor-miracle = winning season; Developer's Favourite = Bradford bias.
  if (options.joeMellorMode) {
    const bradfordCount = countBradfordPlayers(squad);
    triggerAchievementCheck({
      trigger: "quick-season-completed",
      joeMellorComplete: true,
      goatMellorWin: season.wins > season.losses,
      bradfordChallengeComplete:
        bradfordCount >= 5 && season.wins > season.losses,
    });
    return;
  }

  const totalValue = getSquadValue(squad);
  const gradeInfo = getSeasonGradeFromSquad(squad, season, totalValue);
  const bradfordCount = countBradfordPlayers(squad);

  for (const fixture of season.fixtures) {
    if (fixture.result === "W") {
      triggerQuickMatchAchievements(fixture);
    }
  }

  triggerAchievementCheck({
    trigger: "quick-season-completed",
    quickModeLeagueSeason: true,
    seasonWins: season.wins,
    seasonLosses: season.losses,
    seasonDraws: season.draws ?? 0,
    regularSeasonWins: season.wins,
    regularSeasonLosses: season.losses,
    playoffWins: options.playoffWins,
    playoffLosses: options.playoffLosses,
    leagueChampion: options.leagueChampion === true,
    isPerfectSeason: season.isPerfect,
    isUnbeatenSeason: season.losses === 0 && season.wins > 0,
    madePlayoffs: options.madePlayoffs ?? season.leaguePosition <= 6,
    lowRatedSquad: season.squadStrength < 72,
    squadGrade: gradeInfo.grade,
    bradfordPlayerCount: bradfordCount,
    winningRecord: season.wins > season.losses,
    eraCup: options.normalEraMode === true,
  });
}

export function triggerDailyChallengeAchievements(
  currentStreak: number,
  bestStreak: number
): void {
  triggerAchievementCheck({
    trigger: "daily-challenge-completed",
    dailyChallengeCompleted: true,
    dailyCurrentStreak: currentStreak,
    dailyBestStreak: bestStreak,
  });
}

export function triggerQuizAchievements(input: {
  questionsAnswered: number;
  questionsCorrect: number;
  highestPrize: number;
  perfectRun: boolean;
  noLifelines: boolean;
  teamCompleted: boolean;
  teamMillionaire: boolean;
}): void {
  triggerAchievementCheck({
    trigger: "quiz-completed",
    quizQuestionsAnswered: input.questionsAnswered,
    quizQuestionsCorrect: input.questionsCorrect,
    quizHighestPrize: input.highestPrize,
    quizPerfectRun: input.perfectRun,
    quizNoLifelines: input.noLifelines,
    quizTeamCompleted: input.teamCompleted,
    quizTeamMillionaire: input.teamMillionaire,
  });
}

export function triggerMiniGameAchievements(input: {
  played?: boolean;
  wordleWon?: boolean;
  /** All 9 cells of a Rugby League Grid filled. */
  gridPerfect?: boolean;
  hangmanWon?: boolean;
  higherLowerBestStreak?: number;
  higherLowerFivePickWins?: number;
}): void {
  triggerAchievementCheck({
    trigger: "mini-game",
    miniGamePlayed: input.played,
    wordleWon: input.wordleWon,
    gridPerfect: input.gridPerfect,
    hangmanWon: input.hangmanWon,
    higherLowerBestStreak: input.higherLowerBestStreak,
    higherLowerFivePickWins: input.higherLowerFivePickWins,
  });
}

function sumCareerTrophies(legacy: CareerLegacy): number {
  return Object.values(legacy.trophies ?? {}).reduce(
    (sum, n) => sum + (typeof n === "number" ? n : 0),
    0
  );
}

/**
 * Manager Mode: fired once per banked season from the career provider's settle().
 * `legacy` is the legacy *after* banking this season, so trophy totals include it.
 */
export function triggerCareerSeasonAchievements(
  outcome: SeasonOutcome,
  legacy: CareerLegacy,
  state: CareerState
): void {
  const trophies = outcome.trophies ?? [];
  const deadlineDeal = (state.transfers ?? []).some(
    (d) => d.year === outcome.year && d.user === true && d.deadlineDay === true
  );
  triggerAchievementCheck({
    trigger: "career-season-completed",
    careerSeasonCompleted: true,
    careerSeasonTrophies: [...trophies],
    careerPromoted: outcome.promoted === true,
    careerRelegated: outcome.relegated === true,
    careerPerfectSeason:
      trophies.includes("perfect-season") ||
      (outcome.played > 0 && outcome.won === outcome.played),
    careerGrandFinalWon: trophies.includes("grand-final"),
    careerChallengeCupWon: trophies.includes("challenge-cup"),
    careerDeadlineDeal: deadlineDeal,
    careerTotalTrophies: sumCareerTrophies(legacy),
    careerCareersStarted: legacy.careersStarted,
    careerSeasonsCompleted: Math.max(state.history?.length ?? 0, 1),
  });
}

/** Manager Mode: fired when a new career is started (for the Legacy achievement). */
export function triggerCareerStartedAchievements(legacy: CareerLegacy): void {
  triggerAchievementCheck({
    trigger: "career-started",
    careerCareersStarted: legacy.careersStarted,
  });
}

export function triggerClubFundsAchievements(): void {
  triggerAchievementCheck({ trigger: "club-funds-updated" });
}

export function triggerSecretButtonAchievement(): void {
  triggerAchievementCheck({
    trigger: "secret-button",
    secretButtonTriggered: true,
  });
}
