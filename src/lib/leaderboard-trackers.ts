import { getCupFinishRank, getCupWinPercentage } from "./cup-ranking";
import { formatValue } from "./players";
import type { GameDifficulty, GameMode } from "./types";

export type LeaderboardTrackerType =
  | "squad_value"
  | "most_wins"
  | "perfect_runs"
  | "win_percentage"
  | "best_record"
  | "challenge_cup_wins"
  | "cup_match_wins"
  | "cup_finals"
  | "cup_win_percentage"
  | "challenge_cup_team_wins";

export const MIN_GAMES_FOR_WIN_PERCENTAGE = 10;
export const MIN_GAMES_FOR_CUP_WIN_PERCENTAGE = 4;

export interface LeaderboardTrackerEntry {
  username: string;
  squadValue: number;
  achievedAt: string;
  difficulty: GameDifficulty;
  mode: GameMode;
  totalWins: number;
  totalLosses: number;
  perfectRuns: number;
  bestRecordWins: number;
  bestRecordLosses: number;
  bestWinPercentage: number;
  challengeCupWins: number;
  cupFinals: number;
  bestCupFinishRank: number;
  bestCupFinishLabel: string;
  cupWinPercentage: number;
}

export interface LeaderboardTrackerRow {
  rank: number;
  username: string;
  statDisplay: string;
  achievedAt: string;
  difficulty: GameDifficulty;
  mode: GameMode;
  isCurrentUser?: boolean;
}

export const LEADERBOARD_TRACKERS: {
  id: LeaderboardTrackerType;
  label: string;
  shortLabel: string;
  cupOnly?: boolean;
}[] = [
  { id: "squad_value", label: "Top Squad Value", shortLabel: "Top Squad" },
  { id: "most_wins", label: "Most Wins", shortLabel: "Most Wins" },
  {
    id: "perfect_runs",
    label: "Most 27-0 Seasons",
    shortLabel: "27-0 Seasons",
  },
  {
    id: "win_percentage",
    label: "Total Win Percentage",
    shortLabel: "Total Win %",
  },
  { id: "best_record", label: "Best Record", shortLabel: "Best Record" },
  {
    id: "challenge_cup_wins",
    label: "Challenge Cups Won",
    shortLabel: "Cups Won",
    cupOnly: true,
  },
  {
    id: "cup_match_wins",
    label: "Cup Match Wins",
    shortLabel: "Cup Wins",
    cupOnly: true,
  },
  {
    id: "cup_finals",
    label: "Finals Reached",
    shortLabel: "Finals",
    cupOnly: true,
  },
  {
    id: "cup_win_percentage",
    label: "Total Cup Win Percentage",
    shortLabel: "Total Win %",
    cupOnly: true,
  },
  {
    id: "challenge_cup_team_wins",
    label: "Challenge Cup Team Wins",
    shortLabel: "Team Wins",
    cupOnly: true,
  },
];

export function getTrackersForDbMode(
  dbMode: "super-league" | "challenge-cup" | "draft"
) {
  if (dbMode === "challenge-cup") {
    return LEADERBOARD_TRACKERS.filter((t) => t.cupOnly);
  }
  return LEADERBOARD_TRACKERS.filter((t) => !t.cupOnly);
}

export function getDefaultTrackerForDbMode(
  dbMode: "super-league" | "challenge-cup" | "draft"
): LeaderboardTrackerType {
  return getTrackersForDbMode(dbMode)[0]?.id ?? "squad_value";
}

export function isTrackerValidForDbMode(
  tracker: LeaderboardTrackerType,
  dbMode: "super-league" | "challenge-cup" | "draft"
): boolean {
  return getTrackersForDbMode(dbMode).some((t) => t.id === tracker);
}

const CUP_FINISH_LABELS: Record<number, string> = {
  5: "Winners",
  4: "Runners-Up",
  3: "Semi Final",
  2: "Quarter Final",
  1: "Round of 16",
};

export function rankByTracker(
  entries: LeaderboardTrackerEntry[],
  tracker: LeaderboardTrackerType,
  limit: number,
  currentUser: string
): LeaderboardTrackerRow[] {
  const sorted = [...entries].sort((a, b) => {
    switch (tracker) {
      case "squad_value":
        return b.squadValue - a.squadValue;
      case "most_wins":
      case "cup_match_wins":
        return b.totalWins - a.totalWins;
      case "perfect_runs":
        return b.perfectRuns - a.perfectRuns;
      case "win_percentage": {
        const gamesA = a.totalWins + a.totalLosses;
        const gamesB = b.totalWins + b.totalLosses;
        if (gamesA < MIN_GAMES_FOR_WIN_PERCENTAGE) return 1;
        if (gamesB < MIN_GAMES_FOR_WIN_PERCENTAGE) return -1;
        const pctA = gamesA > 0 ? a.totalWins / gamesA : 0;
        const pctB = gamesB > 0 ? b.totalWins / gamesB : 0;
        return pctB - pctA;
      }
      case "best_record": {
        if (b.bestRecordWins !== a.bestRecordWins) {
          return b.bestRecordWins - a.bestRecordWins;
        }
        return a.bestRecordLosses - b.bestRecordLosses;
      }
      case "challenge_cup_wins":
      case "challenge_cup_team_wins":
        return b.challengeCupWins - a.challengeCupWins;
      case "cup_finals":
        return b.cupFinals - a.cupFinals;
      case "cup_win_percentage": {
        const gamesA = a.totalWins + a.totalLosses;
        const gamesB = b.totalWins + b.totalLosses;
        if (gamesA < MIN_GAMES_FOR_CUP_WIN_PERCENTAGE) return 1;
        if (gamesB < MIN_GAMES_FOR_CUP_WIN_PERCENTAGE) return -1;
        return b.cupWinPercentage - a.cupWinPercentage;
      }
      default:
        return 0;
    }
  });

  const filtered = (() => {
    if (tracker === "win_percentage") {
      return sorted.filter(
        (e) => e.totalWins + e.totalLosses >= MIN_GAMES_FOR_WIN_PERCENTAGE
      );
    }
    if (tracker === "cup_win_percentage") {
      return sorted.filter(
        (e) =>
          e.totalWins + e.totalLosses >= MIN_GAMES_FOR_CUP_WIN_PERCENTAGE
      );
    }
    return sorted;
  })();

  return filtered.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    achievedAt: entry.achievedAt,
    difficulty: entry.difficulty,
    mode: entry.mode,
    isCurrentUser: !!currentUser && entry.username === currentUser,
    statDisplay: getTrackerStatDisplay(entry, tracker),
  }));
}

export function getTrackerStatDisplay(
  entry: LeaderboardTrackerEntry,
  tracker: LeaderboardTrackerType
): string {
  switch (tracker) {
    case "squad_value":
      return formatValue(entry.squadValue);
    case "most_wins":
    case "cup_match_wins":
      return String(entry.totalWins);
    case "perfect_runs":
      return String(entry.perfectRuns);
    case "win_percentage": {
      const games = entry.totalWins + entry.totalLosses;
      const pct = games > 0 ? (entry.totalWins / games) * 100 : 0;
      return `${pct.toFixed(1)}%`;
    }
    case "best_record":
      return `${entry.bestRecordWins}-${entry.bestRecordLosses}`;
    case "challenge_cup_wins":
    case "challenge_cup_team_wins":
      return String(entry.challengeCupWins);
    case "cup_finals":
      return String(entry.cupFinals);
    case "cup_win_percentage": {
      const games = entry.totalWins + entry.totalLosses;
      const pct = games > 0 ? (entry.totalWins / games) * 100 : 0;
      return `${pct.toFixed(1)}%`;
    }
    default:
      return "—";
  }
}

export function mergeLeaderboardStats(
  existing: Partial<LeaderboardTrackerEntry> | null | undefined,
  update: {
    squadValue: number;
    wins: number;
    losses: number;
    isPerfectSeason?: boolean;
    cupWon?: boolean;
    cupFinish?: string;
    isCupRun?: boolean;
  }
): Omit<
  LeaderboardTrackerEntry,
  "username" | "achievedAt" | "difficulty" | "mode"
> {
  const isCupRun = update.isCupRun === true;
  const seasonGames = update.wins + update.losses;
  const seasonWinPct =
    seasonGames > 0 ? (update.wins / seasonGames) * 100 : 0;
  const finishRank = getCupFinishRank(update.cupFinish);

  const squadValue = Math.max(existing?.squadValue ?? 0, update.squadValue);
  const totalWins = (existing?.totalWins ?? 0) + update.wins;
  const totalLosses = (existing?.totalLosses ?? 0) + update.losses;
  const perfectRuns = isCupRun
    ? (existing?.perfectRuns ?? 0)
    : (existing?.perfectRuns ?? 0) + (update.isPerfectSeason ? 1 : 0);
  const challengeCupWins = isCupRun
    ? (existing?.challengeCupWins ?? 0) + (update.cupWon ? 1 : 0)
    : (existing?.challengeCupWins ?? 0);

  let cupFinals = existing?.cupFinals ?? 0;
  let bestCupFinishRank = existing?.bestCupFinishRank ?? 0;
  let bestCupFinishLabel = existing?.bestCupFinishLabel ?? "";
  let cupWinPercentage = existing?.cupWinPercentage ?? 0;

  if (isCupRun) {
    if (
      update.cupFinish === "Winners" ||
      update.cupFinish === "Runners-Up"
    ) {
      cupFinals += 1;
    }
    if (finishRank > bestCupFinishRank) {
      bestCupFinishRank = finishRank;
      bestCupFinishLabel =
        update.cupFinish ?? CUP_FINISH_LABELS[finishRank] ?? "";
    }
    const cupGames = totalWins + totalLosses;
    if (cupGames >= MIN_GAMES_FOR_CUP_WIN_PERCENTAGE) {
      cupWinPercentage = (totalWins / cupGames) * 100;
    }
  }

  let bestRecordWins = existing?.bestRecordWins ?? 0;
  let bestRecordLosses = existing?.bestRecordLosses ?? 0;
  if (!isCupRun) {
    if (
      update.wins > bestRecordWins ||
      (update.wins === bestRecordWins && update.losses < bestRecordLosses)
    ) {
      bestRecordWins = update.wins;
      bestRecordLosses = update.losses;
    }
  }

  let bestWinPercentage = existing?.bestWinPercentage ?? 0;
  if (!isCupRun) {
    const totalGames = totalWins + totalLosses;
    if (totalGames >= MIN_GAMES_FOR_WIN_PERCENTAGE) {
      bestWinPercentage = (totalWins / totalGames) * 100;
    }
  }

  return {
    squadValue,
    totalWins,
    totalLosses,
    perfectRuns,
    bestRecordWins,
    bestRecordLosses,
    bestWinPercentage,
    challengeCupWins,
    cupFinals,
    bestCupFinishRank,
    bestCupFinishLabel,
    cupWinPercentage,
  };
}
