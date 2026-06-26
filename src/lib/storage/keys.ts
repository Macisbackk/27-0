export const STORAGE_KEYS = {
  username: "27-0-username",
  stats: "27-0-stats",
  leaderboard: "27-0-leaderboard",
  /** @deprecated Legacy — migrated to normalDifficulty */
  difficulty: "27-0-difficulty",
  /** @deprecated Legacy — migrated to normalDifficulty */
  hardModeEnabled: "27-0-hard-mode-enabled",
  normalDifficulty: "27-0-normal-difficulty",
  draftDifficulty: "27-0-draft-difficulty",
  soundMuted: "27-0-sound-muted",
  cupLeaderboard: "27-0-cup-leaderboard",
  cupTeamWins: "27-0-cup-team-wins",
  eraCupLeaderboard: "27-0-era-cup-leaderboard",
  eraCupTeamWins: "27-0-era-cup-team-wins",
  eraCupTeamWinRuns: "27-0-era-cup-team-win-runs",
  cupTeamWinRuns: "27-0-cup-team-win-runs",
  recruitmentStyle: "27-0-recruitment-style",
  eraTournamentType: "27-0-era-tournament-type",
  cupEraVariant: "27-0-cup-era-variant",
  normalEraVariant: "27-0-normal-era-variant",
  clubFunds: "27-0-club-funds",
  clubFundsLeaderboard: "27-0-club-funds-leaderboard",
  trophyCabinetLeaderboard: "27-0-trophy-cabinet-leaderboard",
  /** One-time local reset marker for squad value leaderboard wipe. */
  squadValueLeaderboardReset: "27-0-squad-value-lb-reset-v1",
  uiThemeStore: "27-0-ui-theme-store",
  /** Cached CSS vars for pre-hydration theme bootstrap */
  uiThemeCssCache: "27-0-ui-theme-css-cache",
  coachbeardMergeComplete: "27-0-coachbeard-merge-v1",
  statsSchemaVersion: "27-0-stats-schema-version",
} as const;

/** Bump when StoredStats shape changes — triggers one-time local migration. */
export const STATS_SCHEMA_VERSION = 2;
