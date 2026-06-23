import { getCupFinishRank } from "./cup-ranking";
import { formatValue } from "./players";
import { formatRecordWithPercentage } from "./lifetime-stats";
import type { GameDifficulty, GameMode } from "./types";

export type LeaderboardTrackerType =
  | "squad_value"
  | "most_wins"
  | "perfect_runs"
  | "best_record"
  | "challenge_cup_wins"
  | "cup_match_wins"
  | "cup_finals"
  | "challenge_cup_team_wins"
  | "total_winnings";

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
  clubFundsOnly?: boolean;
}[] = [
  { id: "best_record", label: "Total Record", shortLabel: "Total Record" },
  { id: "squad_value", label: "Top Squad Value", shortLabel: "Top Squad" },
  { id: "most_wins", label: "Most Wins", shortLabel: "Most Wins" },
  {
    id: "perfect_runs",
    label: "Most 27-0 Seasons",
    shortLabel: "27-0 Seasons",
  },
  {
    id: "challenge_cup_team_wins",
    label: "Challenge Cup Team Wins",
    shortLabel: "Team Wins",
    cupOnly: true,
  },
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
    id: "total_winnings",
    label: "Total Winnings",
    shortLabel: "Total Winnings",
    clubFundsOnly: true,
  },
];

export function getTrackersForDbMode(
  dbMode: "super-league" | "challenge-cup" | "draft" | "fantasy" | "club-funds"
) {
  if (dbMode === "club-funds") {
    return LEADERBOARD_TRACKERS.filter((t) => t.clubFundsOnly);
  }
  if (dbMode === "challenge-cup") {
    const cupTrackers = LEADERBOARD_TRACKERS.filter(
      (t) => t.cupOnly || t.id === "best_record"
    );
    const order: LeaderboardTrackerType[] = [
      "best_record",
      "challenge_cup_team_wins",
      "challenge_cup_wins",
      "cup_match_wins",
      "cup_finals",
    ];
    return order
      .map((id) => cupTrackers.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }
  return LEADERBOARD_TRACKERS.filter((t) => !t.cupOnly && !t.clubFundsOnly);
}

export function getDefaultTrackerForDbMode(
  dbMode: "super-league" | "challenge-cup" | "draft" | "fantasy" | "club-funds"
): LeaderboardTrackerType {
  return getTrackersForDbMode(dbMode)[0]?.id ?? "squad_value";
}

export function isTrackerValidForDbMode(
  tracker: LeaderboardTrackerType,
  dbMode: "super-league" | "challenge-cup" | "draft" | "fantasy" | "club-funds"
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
      case "best_record": {
        if (b.totalWins !== a.totalWins) {
          return b.totalWins - a.totalWins;
        }
        return a.totalLosses - b.totalLosses;
      }
      case "challenge_cup_wins":
      case "challenge_cup_team_wins":
        return b.challengeCupWins - a.challengeCupWins;
      case "cup_finals":
        return b.cupFinals - a.cupFinals;
      default:
        return 0;
    }
  });

  return sorted.slice(0, limit).map((entry, index) => ({
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
    case "best_record":
      return formatRecordWithPercentage(entry.totalWins, entry.totalLosses);
    case "challenge_cup_wins":
    case "challenge_cup_team_wins":
      return String(entry.challengeCupWins);
    case "cup_finals":
      return String(entry.cupFinals);
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

  const bestRecordWins = totalWins;
  const bestRecordLosses = totalLosses;

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

/** Combine two cumulative leaderboard tracker snapshots (e.g. account merge). */
export function combineLeaderboardTrackerStats(
  a: Partial<LeaderboardTrackerEntry>,
  b: Partial<LeaderboardTrackerEntry>
): Omit<
  LeaderboardTrackerEntry,
  "username" | "achievedAt" | "difficulty" | "mode"
> {
  const rankA = a.bestCupFinishRank ?? 0;
  const rankB = b.bestCupFinishRank ?? 0;
  const totalWins = (a.totalWins ?? 0) + (b.totalWins ?? 0);
  const totalLosses = (a.totalLosses ?? 0) + (b.totalLosses ?? 0);
  const cupGames = totalWins + totalLosses;

  return {
    squadValue: Math.max(a.squadValue ?? 0, b.squadValue ?? 0),
    totalWins,
    totalLosses,
    perfectRuns: (a.perfectRuns ?? 0) + (b.perfectRuns ?? 0),
    bestRecordWins: totalWins,
    bestRecordLosses: totalLosses,
    bestWinPercentage:
      cupGames > 0
        ? Math.max(a.bestWinPercentage ?? 0, b.bestWinPercentage ?? 0)
        : totalWins + totalLosses > 0
          ? (totalWins / (totalWins + totalLosses)) * 100
          : 0,
    challengeCupWins: (a.challengeCupWins ?? 0) + (b.challengeCupWins ?? 0),
    cupFinals: (a.cupFinals ?? 0) + (b.cupFinals ?? 0),
    bestCupFinishRank: Math.max(rankA, rankB),
    bestCupFinishLabel:
      rankB > rankA ? (b.bestCupFinishLabel ?? "") : (a.bestCupFinishLabel ?? ""),
    cupWinPercentage:
      cupGames > 0
        ? (totalWins / cupGames) * 100
        : Math.max(a.cupWinPercentage ?? 0, b.cupWinPercentage ?? 0),
  };
}
