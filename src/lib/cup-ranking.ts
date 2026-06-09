import type { CupLeaderboardProfile } from "./storage/cup-leaderboard";

export function applyMatchResultsToStreak(
  currentStreak: number,
  longestStreak: number,
  results: ("W" | "L")[]
): { currentStreak: number; longestStreak: number } {
  let current = currentStreak;
  let longest = longestStreak;
  for (const result of results) {
    if (result === "W") {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return { currentStreak: current, longestStreak: longest };
}

export function getCupWinPercentage(
  wins: number,
  losses: number
): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return Math.round((wins / total) * 1000) / 10;
}

export function getCupFinishRank(finish: string | null | undefined): number {
  switch (finish) {
    case "Winners":
      return 5;
    case "Runners-Up":
      return 4;
    case "Semi Final":
      return 3;
    case "Quarter Final":
      return 2;
    case "Round of 16":
      return 1;
    default:
      return 0;
  }
}

export type CupLeaderboardCategory =
  | "cupsWon"
  | "cupMatchWins"
  | "winPercentage"
  | "finals"
  | "semiFinals"
  | "quarterFinals"
  | "longestCupMatchWinStreak"
  | "longestTournamentWinsInRow";

export const CUP_LEADERBOARD_CATEGORIES: {
  id: CupLeaderboardCategory;
  label: string;
  format: (p: CupLeaderboardProfile) => string;
  sortValue: (p: CupLeaderboardProfile) => number;
}[] = [
  {
    id: "cupsWon",
    label: "Most Challenge Cups Won",
    format: (p) => String(p.cupsWon),
    sortValue: (p) => p.cupsWon,
  },
  {
    id: "cupMatchWins",
    label: "Most Challenge Cup Match Wins",
    format: (p) => String(p.cupMatchWins),
    sortValue: (p) => p.cupMatchWins,
  },
  {
    id: "winPercentage",
    label: "Best Cup Win Percentage",
    format: (p) => `${getCupWinPercentage(p.cupMatchWins, p.cupMatchLosses)}%`,
    sortValue: (p) =>
      p.cupMatchWins + p.cupMatchLosses === 0
        ? 0
        : getCupWinPercentage(p.cupMatchWins, p.cupMatchLosses),
  },
  {
    id: "finals",
    label: "Most Finals Reached",
    format: (p) => String(p.cupFinals),
    sortValue: (p) => p.cupFinals,
  },
  {
    id: "semiFinals",
    label: "Most Semi Finals Reached",
    format: (p) => String(p.cupSemiFinals),
    sortValue: (p) => p.cupSemiFinals,
  },
  {
    id: "quarterFinals",
    label: "Most Quarter Finals Reached",
    format: (p) => String(p.cupQuarterFinals),
    sortValue: (p) => p.cupQuarterFinals,
  },
];

export function rankProfilesByCategory(
  profiles: CupLeaderboardProfile[],
  category: CupLeaderboardCategory
): CupLeaderboardProfile[] {
  const meta = CUP_LEADERBOARD_CATEGORIES.find((c) => c.id === category);
  if (!meta) return profiles;
  return [...profiles]
    .filter((p) => meta.sortValue(p) > 0)
    .sort((a, b) => meta.sortValue(b) - meta.sortValue(a));
}

export function getUserRank(
  profiles: CupLeaderboardProfile[],
  username: string,
  category: CupLeaderboardCategory
): number | null {
  const sorted = rankProfilesByCategory(profiles, category);
  const index = sorted.findIndex((p) => p.username === username);
  if (index === -1) return null;
  return index + 1;
}
