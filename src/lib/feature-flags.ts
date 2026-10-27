/**
 * Feature flags — flip to restore hidden modes without deleting code or data.
 */
export const SHOW_DRAFT_MODE = false;
/** Daily Challenge — UK day key, forced club, streak. Live on home + leaderboard. */
export const SHOW_DAILY_CHALLENGE_UI = true;
/**
 * Weekly Challenge — hidden from players (owner, v1.27). Code, data and tests stay; every entry
 * point (home tile, menu, leaderboard tab, How to play, copy, /play?weekly=1, weekly challenge
 * links) checks this. Flip to true to bring it back.
 */
export const SHOW_WEEKLY_CHALLENGE_UI = false;
/**
 * Auto-fill squad is a Daily Challenge / hidden-mode shortcut only: in ranked Classic (Current, Era,
 * Ball Knower) every player is spun for, so the leaderboard isn't flooded with one-tap seasons.
 * Test builds (NEXT_PUBLIC_E2E=1, set by CI) keep it behind a `?e2e=1` query flag.
 */
export const E2E_BUILD = process.env.NEXT_PUBLIC_E2E === "1";
