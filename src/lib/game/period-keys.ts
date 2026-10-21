/** Leaderboard period keys (UTC). Dependency-free so storage code can use them cheaply. */
export function getWeeklyKey(date?: Date): string {
  const d = date ?? new Date();
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getUTCDay() +
      1) /
      7
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getMonthlyKey(date?: Date): string {
  const d = date ?? new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
