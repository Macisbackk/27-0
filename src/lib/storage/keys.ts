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
  recruitmentStyle: "27-0-recruitment-style",
  normalEraVariant: "27-0-normal-era-variant",
  clubFunds: "27-0-club-funds",
  clubFundsLeaderboard: "27-0-club-funds-leaderboard",
  dailyChallengeClaims: "27-0-daily-challenge-claims",
  dailyChallengeMeta: "27-0-daily-challenge-meta",
  dailyLeaderboard: "27-0-daily-leaderboard",
  trophyCabinetLeaderboard: "27-0-trophy-cabinet-leaderboard",
  /** One-time local reset marker for squad value leaderboard wipe. */
  squadValueLeaderboardReset: "27-0-squad-value-lb-reset-v1",
  uiThemeStore: "27-0-ui-theme-store",
  /** Cached CSS vars for pre-hydration theme bootstrap */
  uiThemeCssCache: "27-0-ui-theme-css-cache",
  /** Account Store boost inventory */
  boostInventory: "27-0-boost-inventory",
  coachbeardMergeComplete: "27-0-coachbeard-merge-v1",
  statsSchemaVersion: "27-0-stats-schema-version",
  /** @deprecated Legacy single save — migrated to slot 0 */
  managerCareer: "27-0-manager-career",
  /** @deprecated Full career JSON — lazily migrated to IndexedDB. */
  managerCareerSlot: (slot: number) => `27-0-manager-career-slot-${slot}`,
  managerCareerMeta: (slot: number) => `27-0-manager-career-meta-${slot}`,
  managerSaveStorageMigrated: "27-0-manager-save-storage-v2",
  /** Session backup when localStorage write fails or before tab teardown on mobile. */
  managerCareerBackup: (slot: number) => `27-0-manager-career-backup-${slot}`,
  managerStats: "27-0-manager-stats",
  managerLeaderboard: "27-0-manager-leaderboard",
  managerActiveSlot: "27-0-manager-active-slot",
  managerOnboarding: "27-0-manager-onboarding",
  achievements: "27-0-achievements",
  /** One-time: existing unlocks treated as acknowledged; post-hydrate baseline set. */
  achievementsBaselineVersion: "27-0-achievements-baseline-version",
  achievementSchemaVersion: "27-0-achievement-schema-version",
  leaderboardEligibilityVersion: "27-0-leaderboard-eligibility-version",
  tabRenderingFixVersion: "27-0-tab-rendering-fix-version",
  matchEventCopyVersion: "27-0-match-event-copy-version",
  mobileHeaderVersion: "27-0-mobile-header-version",
  quickModeSelectionUIVersion: "27-0-qm-selection-ui-version",
  reserveSettingsVersion: "27-0-reserve-settings-version",
} as const;

/** Bump when achievement hydration / acknowledgement migration changes. */
export const ACHIEVEMENTS_BASELINE_VERSION = 2;

/** Priority-pass schema markers. */
export const ACHIEVEMENT_SCHEMA_VERSION = 3;
export const LEADERBOARD_ELIGIBILITY_VERSION = 2;
export const TAB_RENDERING_FIX_VERSION = 4;
export const MATCH_EVENT_COPY_VERSION = 2;
export const MOBILE_HEADER_VERSION = 3;
export const QUICK_MODE_SELECTION_UI_VERSION = 4;
export const RESERVE_SETTINGS_VERSION = 3;

/** Bump when StoredStats shape changes — triggers one-time local migration. */
export const STATS_SCHEMA_VERSION = 3;
