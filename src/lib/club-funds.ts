import type { SeasonResult } from "./game/season-simulation";
import type { GameMode } from "./types";

export const CLUB_FUNDS_REWARDS = {
  leagueLeaders: 15_000,
  topSixFinish: 20_000,
  playoffEliminatorWin: 15_000,
  playoffSemiFinalWin: 30_000,
  playoffFinalRunnerUp: 40_000,
  superLeagueTitle: 100_000,
  perfectSeason: 250_000,
  seasonComplete: 10_000,
  regularSeasonWin: 500,
  twentyWins: 25_000,
} as const;

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
          label: "Play-Off Eliminator Win",
          amount: CLUB_FUNDS_REWARDS.playoffEliminatorWin,
        });
      }
      if (round.round === "Semi Final") {
        lines.push({
          id: "playoff-semi",
          label: "Play-Off Semi-Final Win",
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

const CLUB_FUNDS_INFO_LINES_SOURCE = [
  { label: "Super League Title", amount: CLUB_FUNDS_REWARDS.superLeagueTitle },
  { label: "Grand Final Runner-Up", amount: CLUB_FUNDS_REWARDS.playoffFinalRunnerUp },
  { label: "League Leaders", amount: CLUB_FUNDS_REWARDS.leagueLeaders },
  { label: "Top-Six Finish", amount: CLUB_FUNDS_REWARDS.topSixFinish },
  { label: "Play-Off Semi-Final Win", amount: CLUB_FUNDS_REWARDS.playoffSemiFinalWin },
  { label: "Play-Off Eliminator Win", amount: CLUB_FUNDS_REWARDS.playoffEliminatorWin },
  { label: "27-0 Perfect Season", amount: CLUB_FUNDS_REWARDS.perfectSeason },
  { label: "Season Completed", amount: CLUB_FUNDS_REWARDS.seasonComplete },
  { label: "20+ Wins in a Season", amount: CLUB_FUNDS_REWARDS.twentyWins },
] as const;

/** Earn Club Funds panel — highest payouts first. */
export const CLUB_FUNDS_INFO_LINES = [...CLUB_FUNDS_INFO_LINES_SOURCE].sort(
  (a, b) => b.amount - a.amount
);
