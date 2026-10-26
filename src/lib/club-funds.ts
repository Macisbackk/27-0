import type { SeasonResult } from "./game/season-simulation";
import type { GameMode } from "./types";
import { ACHIEVEMENT_DEFINITIONS } from "./achievements/achievementDefinitions";
import { getDailyChallengeMinimumBonuses } from "./daily-challenge";
import { WEEKLY_TOP10_REWARD } from "./weekly-challenge";
import { SHOW_DAILY_CHALLENGE_UI } from "./feature-flags";
import { GRID_REWARD_PER_CELL, WORDLE_WIN_REWARD } from "./mini-games/reward-amounts";
import { QUIZ_TOP_PRIZE } from "./quiz/prizes";

export const CLUB_FUNDS_REWARDS = {
  leagueLeaders: 30_000,
  topSixFinish: 40_000,
  playoffEliminatorWin: 30_000,
  playoffSemiFinalWin: 60_000,
  playoffFinalRunnerUp: 80_000,
  superLeagueTitle: 200_000,
  perfectSeason: 250_000,
  seasonComplete: 50_000,
  regularSeasonWin: 1_000,
  twentyWins: 50_000,
} as const;

/** One-time grant for first Club Funds init (idempotent via paidRunIds). */
export const CLUB_FUNDS_STARTER_GRANT = 250_000;
export const CLUB_FUNDS_STARTER_RUN_ID = "starter-grant";

export interface ClubFundsEarnedLine {
  id: string;
  label: string;
  amount: number;
}

export interface ClubFundsPayoutResult {
  runId: string;
  lines: ClubFundsEarnedLine[];
  total: number;
  awarded: boolean;
  newBalance: number;
}

export interface ClubFundsRunInput {
  runId: string;
  mode: GameMode;
  isHiddenRun?: boolean;
  seasonResult?: SeasonResult | null;
  /** When set, only regular-season or play-off reward lines are computed. */
  fundsPhase?: "regular" | "playoff";
}

function appendPlayoffFundsLines(
  lines: ClubFundsEarnedLine[],
  seasonResult: SeasonResult
): void {
  const playoff = seasonResult.playoffResult;
  if (!playoff?.qualified) return;

  for (const round of playoff.rounds) {
    if (!round.userPlayed) continue;

    if (round.userWon === true) {
      if (round.round === "Eliminator") {
        lines.push({
          id: "playoff-eliminator",
          label: "Play-off Eliminator Win",
          amount: CLUB_FUNDS_REWARDS.playoffEliminatorWin,
        });
      }
      if (round.round === "Semi Final") {
        lines.push({
          id: "playoff-semi",
          label: "Play-off Semi-final Win",
          amount: CLUB_FUNDS_REWARDS.playoffSemiFinalWin,
        });
      }
      if (round.round === "Grand Final") {
        lines.push({
          id: "super-league-title",
          label: "Super League Title",
          amount: CLUB_FUNDS_REWARDS.superLeagueTitle,
        });
      }
      continue;
    }

    if (round.userWon === false && round.round === "Grand Final") {
      lines.push({
        id: "playoff-final",
        label: "Grand Final Runner-Up",
        amount: CLUB_FUNDS_REWARDS.playoffFinalRunnerUp,
      });
    }
  }
}

/** Display Club Funds in compact header format (£850k, £1.2m, £12m, £100m). */
export function formatClubFunds(amount: number): string {
  const value = Math.round(amount);
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    if (millions >= 100) {
      return `£${Math.round(millions)}m`;
    }
    if (millions >= 10) {
      return `£${Math.round(millions)}m`;
    }
    const rounded = Math.round(millions * 10) / 10;
    const text =
      rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
    return `£${text}m`;
  }
  if (value >= 1_000) {
    return `£${Math.round(value / 1_000)}k`;
  }
  return `£${value}`;
}

/** Full exact value for expanded currency panel (no rounding). */
export function formatClubFundsExact(amount: number): string {
  return `£${Math.round(amount).toLocaleString("en-GB")}`;
}

export function mergeClubFundsPayouts(
  ...payouts: (ClubFundsPayoutResult | null | undefined)[]
): ClubFundsPayoutResult | null {
  const valid = payouts.filter(
    (payout): payout is ClubFundsPayoutResult =>
      !!payout && payout.lines.length > 0
  );
  if (valid.length === 0) return null;

  const lines = valid.flatMap((payout) => payout.lines);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    runId: valid[0].runId,
    lines,
    total,
    awarded: valid.some((payout) => payout.awarded),
    newBalance: valid[valid.length - 1]?.newBalance ?? 0,
  };
}

export function computeClubFundsLines(
  input: ClubFundsRunInput
): ClubFundsEarnedLine[] {
  if (input.isHiddenRun) return [];

  const lines: ClubFundsEarnedLine[] = [];
  const { mode, seasonResult, fundsPhase } = input;

  if (mode === "CLASSIC" && seasonResult) {
    const includeRegular = fundsPhase !== "playoff";
    const includePlayoff = fundsPhase !== "regular";

    if (includeRegular) {
      lines.push({
        id: "season-complete",
        label: "Season Completed",
        amount: CLUB_FUNDS_REWARDS.seasonComplete,
      });

      if (seasonResult.wins > 0) {
        lines.push({
          id: "regular-season-wins",
          label: `Regular Season Wins (${seasonResult.wins})`,
          amount: seasonResult.wins * CLUB_FUNDS_REWARDS.regularSeasonWin,
        });
      }

      if (seasonResult.leaguePosition === 1) {
        lines.push({
          id: "league-leaders",
          label: "League Leaders",
          amount: CLUB_FUNDS_REWARDS.leagueLeaders,
        });
      }

      if (seasonResult.leaguePosition <= 6) {
        lines.push({
          id: "top-six",
          label: "Top-Six Finish",
          amount: CLUB_FUNDS_REWARDS.topSixFinish,
        });
      }

      if (seasonResult.isPerfect) {
        lines.push({
          id: "perfect-season",
          label: "27-0 Perfect Season",
          amount: CLUB_FUNDS_REWARDS.perfectSeason,
        });
      }

      if (seasonResult.wins >= 20) {
        lines.push({
          id: "twenty-wins",
          label: "20+ Wins in a Season",
          amount: CLUB_FUNDS_REWARDS.twentyWins,
        });
      }
    }

    if (includePlayoff) {
      appendPlayoffFundsLines(lines, seasonResult);
    }
  }

  return lines;
}

export interface ClubFundsInfoLine {
  label: string;
  /** Used for sorting and, without `valueText`, shown as an exact amount. */
  amount: number;
  /** Replaces the exact amount when the payout varies (e.g. "from £70,000"). */
  valueText?: string;
}

const DAILY_MIN_BONUSES = getDailyChallengeMinimumBonuses();
const ACHIEVEMENT_REWARDS = ACHIEVEMENT_DEFINITIONS.map((a) => a.rewardClubFunds ?? 0).filter(
  (amount) => amount > 0
);
const ACHIEVEMENT_REWARD_MIN = ACHIEVEMENT_REWARDS.length ? Math.min(...ACHIEVEMENT_REWARDS) : 0;
const ACHIEVEMENT_REWARD_MAX = ACHIEVEMENT_REWARDS.length ? Math.max(...ACHIEVEMENT_REWARDS) : 0;

const CLUB_FUNDS_INFO_LINES_SOURCE: ClubFundsInfoLine[] = [
  { label: "Classic: Super League Title", amount: CLUB_FUNDS_REWARDS.superLeagueTitle },
  { label: "Classic: Grand Final Runner-Up", amount: CLUB_FUNDS_REWARDS.playoffFinalRunnerUp },
  { label: "Classic: League Leaders", amount: CLUB_FUNDS_REWARDS.leagueLeaders },
  { label: "Classic: Top-Six Finish", amount: CLUB_FUNDS_REWARDS.topSixFinish },
  { label: "Classic: Play-off Semi-final Win", amount: CLUB_FUNDS_REWARDS.playoffSemiFinalWin },
  { label: "Classic: Play-off Eliminator Win", amount: CLUB_FUNDS_REWARDS.playoffEliminatorWin },
  { label: "Classic: 27-0 Perfect Season", amount: CLUB_FUNDS_REWARDS.perfectSeason },
  { label: "Classic: Season Completed", amount: CLUB_FUNDS_REWARDS.seasonComplete },
  { label: "Classic: 20+ Wins in a Season", amount: CLUB_FUNDS_REWARDS.twentyWins },
  {
    label: "Classic: Each Regular Season Win",
    amount: CLUB_FUNDS_REWARDS.regularSeasonWin,
  },
  ...(SHOW_DAILY_CHALLENGE_UI
    ? [
        {
          label: "Daily Challenge: Top the Table",
          amount: DAILY_MIN_BONUSES.leagueLeadersBonus,
          valueText: `from ${formatClubFunds(DAILY_MIN_BONUSES.leagueLeadersBonus)}`,
        },
        {
          label: "Daily Challenge: Win the Grand Final",
          amount: DAILY_MIN_BONUSES.playoffTitleBonus,
          valueText: `from ${formatClubFunds(DAILY_MIN_BONUSES.playoffTitleBonus)}`,
        },
        {
          label: "Weekly Challenge: Top 10 finish (once a week)",
          amount: WEEKLY_TOP10_REWARD,
        },
      ]
    : []),
  {
    label: "Golden Point Quiz (first run each day; 10% after)",
    amount: QUIZ_TOP_PRIZE,
    valueText: `up to ${formatClubFunds(QUIZ_TOP_PRIZE)}`,
  },
  { label: "Wordle (once a day)", amount: WORDLE_WIN_REWARD },
  {
    label: "Rugby League Grid (once a day)",
    amount: GRID_REWARD_PER_CELL * 9,
    valueText: `up to ${formatClubFunds(GRID_REWARD_PER_CELL * 9)}`,
  },
  {
    label: "Achievements",
    amount: ACHIEVEMENT_REWARD_MAX,
    valueText: `${formatClubFunds(ACHIEVEMENT_REWARD_MIN)}–${formatClubFunds(ACHIEVEMENT_REWARD_MAX)}`,
  },
];

/** Earn Club Funds panel — highest payouts first. */
export const CLUB_FUNDS_INFO_LINES = [...CLUB_FUNDS_INFO_LINES_SOURCE].sort(
  (a, b) => b.amount - a.amount
);
