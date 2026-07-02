/** Legacy quick-mode cup leaderboard profile shape (merge scripts only). */
export interface CupLeaderboardProfile {
  username: string;
  cupsWon: number;
  cupMatchWins: number;
  cupMatchLosses: number;
  cupFinals: number;
  cupSemiFinals: number;
  cupQuarterFinals: number;
  longestCupMatchWinStreak: number;
  currentCupMatchWinStreak: number;
  longestTournamentWinsInRow: number;
  currentTournamentWinsInRow: number;
  lastUpdated: string;
}
