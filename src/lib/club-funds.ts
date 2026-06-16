import type { ChallengeCupResult } from "./game/challenge-cup-simulation";
import type { SeasonResult } from "./game/season-simulation";
import type { GameMode } from "./types";

export const CLUB_FUNDS_REWARDS = {
  leagueTitle: 100_000,
  challengeCupWin: 75_000,
  eraChallengeCupWin: 75_000,
  fantasyLeagueTitle: 100_000,
  perfectSeason: 250_000,
  cupFinal: 25_000,
  seasonComplete: 10_000,
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
  cupResult?: ChallengeCupResult | null;
}

/** Display Club Funds in compact header format (£850k, £1.2m, £12m, £100m). */
export function formatClubFunds(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
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
  if (amount >= 1_000) {
    return `£${Math.round(amount / 1_000)}k`;
  }
  return `£${amount}`;
}

export function computeClubFundsLines(
  input: ClubFundsRunInput
): ClubFundsEarnedLine[] {
  if (input.isHiddenRun) return [];

  const lines: ClubFundsEarnedLine[] = [];
  const { mode, seasonResult, cupResult } = input;

  if (mode === "CLASSIC" && seasonResult) {
    lines.push({
      id: "season-complete",
      label: "Season Completed",
      amount: CLUB_FUNDS_REWARDS.seasonComplete,
    });

    if (seasonResult.leaguePosition === 1) {
      lines.push({
        id: "league-title",
        label: "League Title",
        amount: CLUB_FUNDS_REWARDS.leagueTitle,
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

  if (mode === "FANTASY" && seasonResult) {
    lines.push({
      id: "season-complete",
      label: "Season Completed",
      amount: CLUB_FUNDS_REWARDS.seasonComplete,
    });

    if (seasonResult.leaguePosition === 1) {
      lines.push({
        id: "fantasy-title",
        label: "Fantasy League Title",
        amount: CLUB_FUNDS_REWARDS.fantasyLeagueTitle,
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

  if (mode === "CHALLENGE_CUP" && cupResult) {
    if (cupResult.eraMode) {
      if (cupResult.isWinner) {
        lines.push({
          id: "era-cup-win",
          label: "Era Challenge Cup Win",
          amount: CLUB_FUNDS_REWARDS.eraChallengeCupWin,
        });
      } else if (
        cupResult.finish === "Runners-Up" ||
        cupResult.finish === "Winners"
      ) {
        lines.push({
          id: "cup-final",
          label: "Cup Final Appearance",
          amount: CLUB_FUNDS_REWARDS.cupFinal,
        });
      }
    } else {
      if (cupResult.isWinner) {
        lines.push({
          id: "cup-win",
          label: "Challenge Cup Win",
          amount: CLUB_FUNDS_REWARDS.challengeCupWin,
        });
      } else if (
        cupResult.finish === "Runners-Up" ||
        cupResult.finish === "Winners"
      ) {
        lines.push({
          id: "cup-final",
          label: "Cup Final Appearance",
          amount: CLUB_FUNDS_REWARDS.cupFinal,
        });
      }
    }
  }

  return lines;
}

export const CLUB_FUNDS_INFO_LINES = [
  { label: "League Title", amount: CLUB_FUNDS_REWARDS.leagueTitle },
  { label: "Challenge Cup Win", amount: CLUB_FUNDS_REWARDS.challengeCupWin },
  { label: "Era Challenge Cup Win", amount: CLUB_FUNDS_REWARDS.eraChallengeCupWin },
  { label: "Fantasy League Title", amount: CLUB_FUNDS_REWARDS.fantasyLeagueTitle },
  { label: "27-0 Perfect Season", amount: CLUB_FUNDS_REWARDS.perfectSeason },
  { label: "Cup Final Appearance", amount: CLUB_FUNDS_REWARDS.cupFinal },
  { label: "Season Completed", amount: CLUB_FUNDS_REWARDS.seasonComplete },
  { label: "20+ Wins in a Season", amount: CLUB_FUNDS_REWARDS.twentyWins },
] as const;
