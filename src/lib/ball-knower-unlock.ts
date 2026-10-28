/**
 * Ball Knower mode is earned, not bought (owner, v1.47): it unlocks after the coach's first
 * 27-0 season in any ranked mode (Classic, Era, Daily…; hidden novelty modes don't count).
 * Unlocking grants the mode-ball-knower item, so it rides the cosmetics cloud sync and anyone who
 * bought it before keeps it.
 */
import { BALL_KNOWER_ID } from "./cosmetics";
import { getAllStats } from "./storage/stats";
import { grantCosmetic, ownsCosmetic } from "./storage/cosmetics-store";

export const BALL_KNOWER_UNLOCK_TEXT = "Go 27-0 once to unlock.";

/** Any lifetime stats bucket with a perfect season. */
export function hasGone27Nil(): boolean {
  try {
    const all = getAllStats() as unknown as Record<string, { totalPerfectSeasons?: number } | undefined>;
    return Object.values(all).some((s) => !!s && typeof s === "object" && Number(s.totalPerfectSeasons) > 0);
  } catch {
    return false;
  }
}

export function isBallKnowerUnlocked(): boolean {
  try {
    return ownsCosmetic(BALL_KNOWER_ID) || hasGone27Nil();
  } catch {
    return false;
  }
}

/** Grant the mode once a 27-0 is on record. Returns true when it was newly unlocked. */
export function syncBallKnowerUnlock(): boolean {
  try {
    if (ownsCosmetic(BALL_KNOWER_ID) || !hasGone27Nil()) return false;
    return grantCosmetic(BALL_KNOWER_ID);
  } catch {
    return false;
  }
}

/** Call after a season: a 27-0 (not in a hidden mode) unlocks Ball Knower straight away. */
export function unlockBallKnowerAfterSeason(perfect: boolean, hiddenMode: boolean): boolean {
  if (!perfect || hiddenMode) return false;
  try {
    if (ownsCosmetic(BALL_KNOWER_ID)) return false;
    return grantCosmetic(BALL_KNOWER_ID);
  } catch {
    return false;
  }
}
