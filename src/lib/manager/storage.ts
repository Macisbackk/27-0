/**
 * Robust, versioned persistence layer for Manager Mode.
 * Uses dedicated storage keys isolated from other game modes.
 */

import { MANAGER_SAVE_VERSION } from "./rules";
import type { ManagerState } from "./types";

const SAVE_KEY_PREFIX = "27-0-manager-save-v3-slot-";
const AUTO_SAVE_KEY = "27-0-manager-save-v3-autosave";
const ACTIVE_SLOT_KEY = "27-0-manager-active-slot-v3";

export interface SaveMetadata {
  slot: number | "auto";
  clubName: string;
  season: number;
  week: number;
  savedAt: string;
  reputation: number;
}

export function getSlotStorageKey(slot: number | "auto"): string {
  return slot === "auto" ? AUTO_SAVE_KEY : `${SAVE_KEY_PREFIX}${slot}`;
}

export function saveManagerState(
  state: ManagerState,
  slot: number | "auto" = 0
): { success: boolean; error?: string } {
  if (typeof window === "undefined") return { success: false, error: "Window unavailable" };

  try {
    const key = getSlotStorageKey(slot);
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(key, serialized);

    if (slot !== "auto") {
      window.localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Storage write failed (quota exceeded)",
    };
  }
}

export function loadManagerState(slot: number | "auto" = 0): ManagerState | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getSlotStorageKey(slot);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ManagerState;
    if (!parsed || !parsed.players || !parsed.clubs || !parsed.calendar) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getSaveSlotMetadata(slot: number | "auto"): SaveMetadata | null {
  if (typeof window === "undefined") return null;

  try {
    const state = loadManagerState(slot);
    if (!state) return null;

    const club = state.clubs[state.manager.clubId];
    return {
      slot,
      clubName: club?.name || "Unknown Club",
      season: state.calendar.currentSeason,
      week: state.calendar.currentWeek,
      savedAt: new Date().toLocaleDateString(),
      reputation: club?.reputation || 3,
    };
  } catch {
    return null;
  }
}

export function deleteSaveSlot(slot: number | "auto"): boolean {
  if (typeof window === "undefined") return false;

  try {
    const key = getSlotStorageKey(slot);
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function exportSaveToJson(state: ManagerState): string {
  return JSON.stringify(state, null, 2);
}

export function importSaveFromJson(jsonStr: string): ManagerState | null {
  try {
    const parsed = JSON.parse(jsonStr) as ManagerState;
    if (parsed && parsed.players && parsed.clubs && parsed.calendar && parsed.version) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
