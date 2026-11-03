/**
 * Reading / writing the local run history (see run-history.ts). Split out so pages that only
 * read it (home mode unlocks, store, records) don't pull in squad-analysis and, through it,
 * the player database.
 */
import { normalizeRunHistory, type RunHistoryEntry } from "../records";

export const RUN_HISTORY_KEY = "27-0-run-history";
export const RUN_HISTORY_CHANGED_EVENT = "27-0-run-history-changed";

export function loadRunHistory(): RunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeRunHistory(JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveRunHistory(history: RunHistoryEntry[]): void {
  try {
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history));
    window.dispatchEvent(new Event(RUN_HISTORY_CHANGED_EVENT));
  } catch {
    // storage full / blocked: records just won't include this run
  }
}
