/**
 * "Quick spins" — a shorter reel (~0.9s instead of ~2.3s) for players who know the drill.
 *
 * Stored per device. Until the player has chosen, it defaults ON once they have finished a
 * full season (first run gets the full reel so the spin reads as a spin), OFF before that.
 * prefers-reduced-motion still wins: the reel lands instantly either way.
 */
import { STORAGE_KEYS } from "./keys";

export const QUICK_SPINS_KEY = "27-0-quick-spins";
/** Set once the player finishes a regular season (any Classic variant). */
export const FIRST_RUN_DONE_KEY = "27-0-first-run-done";
export const QUICK_SPINS_CHANGED_EVENT = "27-0-quick-spins-changed";

function readFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** True once a full regular season has been finished on this device. */
export function hasFinishedFirstRun(): boolean {
  if (readFlag(FIRST_RUN_DONE_KEY) === "1") return true;
  // Players from before this setting: a Squad Book with a recorded run means they've done one.
  const book = readFlag(STORAGE_KEYS.squadBook);
  if (!book) return false;
  try {
    const parsed = JSON.parse(book) as { runs?: unknown };
    return Array.isArray(parsed.runs) && parsed.runs.length > 0;
  } catch {
    return false;
  }
}

export function markFirstRunFinished(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FIRST_RUN_DONE_KEY, "1");
  } catch {
    // ignore
  }
}

/** Resolve the setting from raw stored values (pure, for tests). */
export function resolveQuickSpins(stored: string | null, finishedFirstRun: boolean): boolean {
  if (stored === "1") return true;
  if (stored === "0") return false;
  return finishedFirstRun;
}

export function getQuickSpins(): boolean {
  return resolveQuickSpins(readFlag(QUICK_SPINS_KEY), hasFinishedFirstRun());
}

export function setQuickSpins(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUICK_SPINS_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(QUICK_SPINS_CHANGED_EVENT, { detail: { on } }));
}
