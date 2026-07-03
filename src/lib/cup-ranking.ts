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
  return Math.round((wins / total) * 100);
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
