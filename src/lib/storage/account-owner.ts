import { STORAGE_KEYS } from "./keys";

/**
 * Which signed-in account the progress on this device belongs to.
 *
 * Without this, signing out of account A and into account B on the same phone merged A's
 * Club Funds, boosts, themes, achievements and stats into B (and uploaded them to B's cloud).
 * Guest progress (no owner yet) still merges into the first account that signs in.
 */
const OWNER_KEY = "27-0-account-owner";

/** Per-account data that is backed up to the cloud and re-downloaded on sign-in. */
const ACCOUNT_KEYS: readonly string[] = [
  STORAGE_KEYS.stats,
  STORAGE_KEYS.clubFunds,
  STORAGE_KEYS.dailyChallengeClaims,
  STORAGE_KEYS.dailyChallengeMeta,
  // Today's counted Daily attempt (lib/daily-challenge.ts DAILY_ATTEMPT_KEY) — backed up with
  // the streak so a second device doesn't get a fresh counted attempt.
  "27-0-daily-attempt",
  STORAGE_KEYS.uiThemeStore,
  STORAGE_KEYS.cosmeticsStore,
  STORAGE_KEYS.uiThemeCssCache,
  STORAGE_KEYS.boostInventory,
  STORAGE_KEYS.achievements,
  "27-0-career-v2-save",
  "27-0-career-v2-legacy",
  // Device-only, but submitted to the mini-game leaderboards under whoever is signed in.
  STORAGE_KEYS.quizStats,
  STORAGE_KEYS.wordleStats,
  STORAGE_KEYS.gridStats,
  // Today's grid (and whether its reward is banked) belongs to whoever played it.
  STORAGE_KEYS.gridRun,
  STORAGE_KEYS.hangmanStats,
  STORAGE_KEYS.higherLowerStats,
  // Weekly Challenge: this week's ranked attempt / unsent entry and last week's cached finish.
  // Left behind, account B inherited A's attempt (and its unsent score was sent as B's), and
  // A's cached "not top 10" stopped B's own top-10 payout being looked up.
  STORAGE_KEYS.weeklyChallenge,
  // Daily welcome bonus streak cache (lib/daily-bonus.ts); the streak itself comes from the ledger.
  "27-0-daily-bonus",
  // Today's Daily Missions progress (lib/daily-missions.ts DAILY_MISSIONS_STORAGE_KEY); payouts
  // themselves are in the Club Funds ledger.
  "27-0-daily-missions",
];

/** Exported for scripts: the per-account keys cleared when another account signs in. */
export const ACCOUNT_STORAGE_KEYS = ACCOUNT_KEYS;

export function getDeviceAccountOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/**
 * Call before merging cloud data for `userId`. Returns true if another account's local
 * progress was cleared.
 */
export function claimDeviceForAccount(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    let cleared = false;
    if (owner && owner !== userId) {
      for (const key of ACCOUNT_KEYS) localStorage.removeItem(key);
      cleared = true;
    }
    localStorage.setItem(OWNER_KEY, userId);
    return cleared;
  } catch {
    return false;
  }
}

/** After an account is deleted: remove that account's progress from this device too. */
export function clearDeviceAccountData(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of ACCOUNT_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable */
  }
}
