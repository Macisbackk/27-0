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
  recruitmentStyle: "27-0-recruitment-style",
} as const;
