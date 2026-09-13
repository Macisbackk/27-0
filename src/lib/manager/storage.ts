/**
 * Robust, versioned persistence layer for Manager Mode.
 * Uses dedicated storage keys isolated from other game modes.
 */

import { MANAGER_SAVE_VERSION } from "./rules";
import { formatRflSeasonReviewFromBodyRecord } from "./rollover";
import type { ManagerState } from "./types";

const SAVE_KEY_PREFIX = "27-0-manager-save-v3-slot-";
const AUTO_SAVE_KEY = "27-0-manager-save-v3-autosave";
const ACTIVE_SLOT_KEY = "27-0-manager-active-slot-v3";

export interface SaveMetadata {
  slot: number | "auto";
  clubName: string;
  clubId?: string;
  season: number;
  week: number;
  savedAt: string;
  savedAtTimestamp?: number;
  reputation: number;
  managerName?: string;
  competitionId?: string;
  divisionName?: string;
  phase?: string;
}

export function getSlotStorageKey(slot: number | "auto"): string {
  return slot === "auto" ? AUTO_SAVE_KEY : `${SAVE_KEY_PREFIX}${slot}`;
}

/** Numbered career slot last chosen via Save / New Game / Load (not autosave). */
export function getActiveSlotIndex(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SLOT_KEY);
    if (raw == null || raw === "") return null;
    const slot = parseInt(raw, 10);
    return Number.isFinite(slot) ? slot : null;
  } catch {
    return null;
  }
}

/**
 * Persist ongoing career progress. Always writes the autosave only —
 * numbered slots are manual checkpoints and must not be overwritten by play.
 */
export function persistManagerProgress(state: ManagerState): {
  success: boolean;
  error?: string;
} {
  return saveManagerState(state, "auto");
}

export function saveManagerState(
  state: ManagerState,
  slot: number | "auto" = "auto"
): { success: boolean; error?: string } {
  if (typeof window === "undefined") return { success: false, error: "Window unavailable" };

  try {
    const key = getSlotStorageKey(slot);
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(key, serialized);

    if (slot !== "auto") {
      window.localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
    }

    // Cache metadata for fast inspection without parsing full save file
    const club = state.clubs[state.manager.clubId];
    const now = Date.now();
    const dateStr = new Date(now).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const meta: SaveMetadata = {
      slot,
      clubName: club?.name || "Unknown Club",
      clubId: club?.id || state.manager.clubId,
      season: state.calendar.currentSeason,
      week: state.calendar.currentWeek,
      savedAt: dateStr,
      savedAtTimestamp: now,
      reputation: club?.reputation || 3,
      managerName: state.manager.name,
      competitionId: club?.competitionId,
      divisionName: club?.competitionId === "super-league" ? "Super League" : "Championship",
      phase: state.calendar.phase,
    };
    window.localStorage.setItem(`${key}-meta`, JSON.stringify(meta));

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Storage write failed (quota exceeded)",
    };
  }
}

function upgradeLoadedManagerState(state: ManagerState): ManagerState {
  if (!state) return state;

  // Ensure optional developmentResults arrays exist on older saves
  let clubs = state.clubs;
  let clubsTouched = false;
  for (const [id, club] of Object.entries(state.clubs)) {
    if (!club.developmentResults) {
      if (!clubsTouched) {
        clubs = { ...state.clubs };
        clubsTouched = true;
      }
      clubs[id] = { ...club, developmentResults: [] };
    }
  }
  const withDev = clubsTouched ? { ...state, clubs } : state;

  // Upgrade / repair any outdated RFL Season Review inbox messages from archived history
  if (withDev.seasonHistory && withDev.seasonHistory.length > 0 && withDev.inbox?.messages) {
    let updated = false;
    const messages = withDev.inbox.messages.map((m) => {
      if (
        m.sender === "Rugby Football League" &&
        m.subject.includes("Season Review & Roll of Honour")
      ) {
        const historyRecord = withDev.seasonHistory!.find((rec) =>
          m.subject.includes(`${rec.season} Season Review`)
        );
        if (historyRecord && !m.body.includes("PROMOTION & RELEGATION")) {
          updated = true;
          return {
            ...m,
            body: formatRflSeasonReviewFromBodyRecord(historyRecord),
          };
        }
      }
      return m;
    });

    if (updated) {
      return {
        ...withDev,
        inbox: {
          ...withDev.inbox,
          messages,
        },
      };
    }
  }

  return withDev;
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

    return upgradeLoadedManagerState(parsed);
  } catch {
    return null;
  }
}

export function getSaveSlotMetadata(slot: number | "auto"): SaveMetadata | null {
  if (typeof window === "undefined") return null;

  try {
    const metaKey = `${getSlotStorageKey(slot)}-meta`;
    const cachedMetaRaw = window.localStorage.getItem(metaKey);
    if (cachedMetaRaw) {
      try {
        const meta = JSON.parse(cachedMetaRaw) as SaveMetadata;
        if (meta && meta.clubName) return meta;
      } catch {
        /* fallback to loading full state */
      }
    }

    const state = loadManagerState(slot);
    if (!state) return null;

    const club = state.clubs[state.manager.clubId];
    return {
      slot,
      clubName: club?.name || "Unknown Club",
      clubId: club?.id || state.manager.clubId,
      season: state.calendar.currentSeason,
      week: state.calendar.currentWeek,
      savedAt: new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
      reputation: club?.reputation || 3,
      managerName: state.manager.name,
      competitionId: club?.competitionId,
      divisionName: club?.competitionId === "super-league" ? "Super League" : "Championship",
      phase: state.calendar.phase,
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
    window.localStorage.removeItem(`${key}-meta`);
    if (slot !== "auto") {
      const active = window.localStorage.getItem(ACTIVE_SLOT_KEY);
      if (active === String(slot)) {
        window.localStorage.removeItem(ACTIVE_SLOT_KEY);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function getAllAvailableSaves(): SaveMetadata[] {
  if (typeof window === "undefined") return [];

  const slots: (number | "auto")[] = [0, 1, 2, "auto"];
  const list: SaveMetadata[] = [];
  for (const s of slots) {
    const meta = getSaveSlotMetadata(s);
    if (meta) {
      list.push(meta);
    }
  }
  return list;
}

export function getMostRecentSave(): SaveMetadata | null {
  const all = getAllAvailableSaves();
  if (all.length === 0) return null;

  // Prefer true recency (autosave advances every week; numbered slots are checkpoints).
  all.sort((a, b) => (b.savedAtTimestamp || 0) - (a.savedAtTimestamp || 0));
  return all[0];
}

export function exportSaveToJson(state: ManagerState): string {
  return JSON.stringify(state, null, 2);
}

export function importSaveFromJson(jsonStr: string): ManagerState | null {
  try {
    const parsed = JSON.parse(jsonStr) as ManagerState;
    if (parsed && parsed.players && parsed.clubs && parsed.calendar && parsed.version) {
      return upgradeLoadedManagerState(parsed);
    }
    return null;
  } catch {
    return null;
  }
}
