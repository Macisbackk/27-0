import { formatValue } from "./players";
import type { GameDifficulty, GameMode } from "./types";

export type LeaderboardTrackerType =
  | "squad_value"
  | "most_wins"
  | "perfect_runs"
  | "win_percentage"
  | "best_record"
  | "challenge_cup_wins";

export const MIN_GAMES_FOR_WIN_PERCENTAGE = 10;

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
  cupOnly?: boolean;
}[] = [
  { id: "squad_value", label: "Top Squad Value" },
  { id: "most_wins", label: "Most Wins" },
  { id: "perfect_runs", label: "Most 27-0 Seasons" },
  { id: "win_percentage", label: "Best Win Percentage" },
  { id: "best_record", label: "Best Record" },
  { id: "challenge_cup_wins", label: "Challenge Cup Wins", cupOnly: true },
];

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

function formatWinPercentage(wins: number, losses: number): string {
  const games = wins + losses;
  if (games === 0) return "0%";
  return `${Math.round((wins / games) * 1000) / 10}%`;
}

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
        return b.totalWins - a.totalWins;
      case "perfect_runs":
        return b.perfectRuns - a.perfectRuns;
      case "win_percentage": {
        const gamesA = a.bestRecordWins + a.bestRecordLosses;
        const gamesB = b.bestRecordWins + b.bestRecordLosses;
        if (gamesA < MIN_GAMES_FOR_WIN_PERCENTAGE) return 1;
        if (gamesB < MIN_GAMES_FOR_WIN_PERCENTAGE) return -1;
        return b.bestWinPercentage - a.bestWinPercentage;
      }
      case "best_record": {
        if (b.bestRecordWins !== a.bestRecordWins) {
          return b.bestRecordWins - a.bestRecordWins;
        }
        return a.bestRecordLosses - b.bestRecordLosses;
      }
      case "challenge_cup_wins":
        return b.challengeCupWins - a.challengeCupWins;
      default:
        return 0;
    }
  });

  const filtered =
    tracker === "win_percentage"
      ? sorted.filter(
          (e) =>
            e.bestRecordWins + e.bestRecordLosses >= MIN_GAMES_FOR_WIN_PERCENTAGE
        )
      : sorted;

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
      return String(entry.totalWins);
    case "perfect_runs":
      return String(entry.perfectRuns);
    case "win_percentage":
      return `${entry.bestWinPercentage.toFixed(1)}%`;
    case "best_record":
      return formatRecord(entry.bestRecordWins, entry.bestRecordLosses);
    case "challenge_cup_wins":
      return String(entry.challengeCupWins);
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
  }
): Omit<
  LeaderboardTrackerEntry,
  "username" | "achievedAt" | "difficulty" | "mode"
> {
  const seasonGames = update.wins + update.losses;
  const seasonWinPct =
    seasonGames > 0 ? (update.wins / seasonGames) * 100 : 0;

  const squadValue = Math.max(existing?.squadValue ?? 0, update.squadValue);
  const totalWins = (existing?.totalWins ?? 0) + update.wins;
  const totalLosses = (existing?.totalLosses ?? 0) + update.losses;
  const perfectRuns =
    (existing?.perfectRuns ?? 0) + (update.isPerfectSeason ? 1 : 0);
  const challengeCupWins =
    (existing?.challengeCupWins ?? 0) + (update.cupWon ? 1 : 0);

  let bestRecordWins = existing?.bestRecordWins ?? 0;
  let bestRecordLosses = existing?.bestRecordLosses ?? 0;
  if (
    update.wins > bestRecordWins ||
    (update.wins === bestRecordWins && update.losses < bestRecordLosses)
  ) {
    bestRecordWins = update.wins;
    bestRecordLosses = update.losses;
  }

  let bestWinPercentage = existing?.bestWinPercentage ?? 0;
  if (
    seasonGames >= MIN_GAMES_FOR_WIN_PERCENTAGE &&
    seasonWinPct > bestWinPercentage
  ) {
    bestWinPercentage = seasonWinPct;
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
  };
}
