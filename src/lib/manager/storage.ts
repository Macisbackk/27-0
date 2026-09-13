/**
 * Robust, versioned persistence layer for Manager Mode.
 * Full careers are stored in IndexedDB (localStorage quota is ~5MB and a mid-season
 * save with key-moments balloons past that). Tiny metadata stays in localStorage.
 */

import { MANAGER_SAVE_VERSION } from "./rules";
import { formatRflSeasonReviewFromBodyRecord } from "./rollover";
import type { ManagerFixture, ManagerState } from "./types";

const SAVE_KEY_PREFIX = "27-0-manager-save-v3-slot-";
const AUTO_SAVE_KEY = "27-0-manager-save-v3-autosave";
const ACTIVE_SLOT_KEY = "27-0-manager-active-slot-v3";

const IDB_NAME = "27-0-manager-saves-v4";
const IDB_STORE = "slots";
const IDB_VERSION = 1;

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
 * Strip bulky regenerable match detail so persistence stays small.
 * Key moments are rebuilt via ensureFixtureKeyMoments; AI match ratings are disposable.
 */
export function pruneManagerStateForStorage(state: ManagerState): ManagerState {
  const uid = state.manager.clubId;
  const currentWeek = state.calendar.currentWeek;

  const competitions: ManagerState["competitions"] = { ...state.competitions };
  for (const id of Object.keys(state.competitions) as Array<keyof ManagerState["competitions"]>) {
    const comp = state.competitions[id];
    competitions[id] = {
      ...comp,
      fixtures: comp.fixtures.map((f) => pruneFixtureForStorage(f, uid, currentWeek)),
    };
  }

  const clubs: ManagerState["clubs"] = {};
  for (const [id, club] of Object.entries(state.clubs)) {
    clubs[id] = {
      ...club,
      finances: {
        ...club.finances,
        history: (club.finances.history || []).slice(0, 36),
      },
      developmentResults: (club.developmentResults || []).slice(0, 16),
    };
  }

  const players: ManagerState["players"] = {};
  for (const [pid, player] of Object.entries(state.players)) {
    players[pid] = {
      ...player,
      stats: {
        ...player.stats,
        matchRatings: (player.stats.matchRatings || []).slice(0, 5),
      },
    };
  }

  return {
    ...state,
    version: state.version || MANAGER_SAVE_VERSION,
    competitions,
    clubs,
    players,
    inbox: {
      ...state.inbox,
      messages: (state.inbox.messages || []).slice(0, 50),
      unreadCount: Math.min(
        state.inbox.unreadCount || 0,
        (state.inbox.messages || []).slice(0, 50).filter((m) => !m.isRead).length
      ),
    },
    transfers: {
      ...state.transfers,
      completedTransfers: (state.transfers.completedTransfers || []).slice(0, 60),
      activeBids: state.transfers.activeBids || [],
      activeLoans: state.transfers.activeLoans || [],
      listedPlayerIds: state.transfers.listedPlayerIds || [],
      pendingLoanOffers: state.transfers.pendingLoanOffers || [],
    },
    seasonHistory: (state.seasonHistory || []).slice(-8),
  };
}

function pruneFixtureForStorage(
  fixture: ManagerFixture,
  userClubId: string,
  currentWeek: number
): ManagerFixture {
  const involvesUser =
    fixture.homeClubId === userClubId || fixture.awayClubId === userClubId;
  const recentUser =
    involvesUser && fixture.isPlayed && fixture.week >= currentWeek - 6;

  const next: ManagerFixture = { ...fixture };
  // Always drop animated key-moments (regenerated on demand)
  delete next.keyMoments;
  // Keep ratings only for recent user matches (match review)
  if (!recentUser) {
    delete next.playerPerformances;
  }
  return next;
}

function buildSaveMetadata(state: ManagerState, slot: number | "auto"): SaveMetadata {
  const club = state.clubs[state.manager.clubId];
  const now = Date.now();
  const dateStr = new Date(now).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
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
    divisionName:
      club?.competitionId === "super-league" ? "Super League" : "Championship",
    phase: state.calendar.phase,
  };
}

function writeMeta(slot: number | "auto", meta: SaveMetadata): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${getSlotStorageKey(slot)}-meta`,
      JSON.stringify(meta)
    );
  } catch {
    /* meta is best-effort */
  }
}

function clearLegacyLocalSave(slot: number | "auto"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getSlotStorageKey(slot));
  } catch {
    /* ignore */
  }
}

function openManagerSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function idbPut(slotKey: string, payload: string): Promise<void> {
  const db = await openManagerSaveDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.objectStore(IDB_STORE).put(payload, slotKey);
    });
  } finally {
    db.close();
  }
}

async function idbGet(slotKey: string): Promise<string | null> {
  const db = await openManagerSaveDb();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(slotKey);
      req.onsuccess = () => {
        const val = req.result;
        resolve(typeof val === "string" ? val : val == null ? null : String(val));
      };
      req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(slotKey: string): Promise<void> {
  const db = await openManagerSaveDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
      tx.objectStore(IDB_STORE).delete(slotKey);
    });
  } finally {
    db.close();
  }
}

function tryLocalStorageWrite(slotKey: string, serialized: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(slotKey, serialized);
    return true;
  } catch {
    try {
      window.localStorage.removeItem(slotKey);
    } catch {
      /* ignore */
    }
    return false;
  }
}

/**
 * Persist ongoing career progress. Always writes the autosave only —
 * numbered slots are manual checkpoints and must not be overwritten by play.
 */
export async function persistManagerProgress(state: ManagerState): Promise<{
  success: boolean;
  error?: string;
}> {
  return saveManagerState(state, "auto");
}

export async function saveManagerState(
  state: ManagerState,
  slot: number | "auto" = "auto"
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined") {
    return { success: false, error: "Window unavailable" };
  }

  try {
    const key = getSlotStorageKey(slot);
    const pruned = pruneManagerStateForStorage(state);
    const serialized = JSON.stringify(pruned);
    const meta = buildSaveMetadata(pruned, slot);

    let wrote = false;
    try {
      await idbPut(key, serialized);
      wrote = true;
      // Free localStorage quota left by older unpruned v3 blobs
      clearLegacyLocalSave(slot);
    } catch {
      // Fall back to pruned localStorage (early-season / test environments)
      clearLegacyLocalSave(slot);
      wrote = tryLocalStorageWrite(key, serialized);
      if (!wrote) {
        return {
          success: false,
          error:
            "Storage full — browser save quota exceeded. Export a JSON backup, delete an old slot, then try again.",
        };
      }
    }

    if (slot !== "auto") {
      try {
        window.localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
      } catch {
        /* ignore */
      }
    }
    writeMeta(slot, meta);

    return { success: wrote };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Storage write failed (quota exceeded)";
    return { success: false, error: message };
  }
}

function upgradeLoadedManagerState(state: ManagerState): ManagerState {
  if (!state) return state;

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

  const withOffers: ManagerState = {
    ...withDev,
    transfers: {
      ...withDev.transfers,
      activeBids: withDev.transfers.activeBids || [],
      activeLoans: withDev.transfers.activeLoans || [],
      listedPlayerIds: withDev.transfers.listedPlayerIds || [],
      completedTransfers: withDev.transfers.completedTransfers || [],
      pendingLoanOffers: withDev.transfers.pendingLoanOffers || [],
    },
  };

  if (withOffers.seasonHistory && withOffers.seasonHistory.length > 0 && withOffers.inbox?.messages) {
    let updated = false;
    const messages = withOffers.inbox.messages.map((m) => {
      if (
        m.sender === "Rugby Football League" &&
        m.subject.includes("Season Review & Roll of Honour")
      ) {
        const historyRecord = withOffers.seasonHistory!.find((rec) =>
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
        ...withOffers,
        inbox: {
          ...withOffers.inbox,
          messages,
        },
      };
    }
  }

  return withOffers;
}

function parseManagerStateRaw(raw: string): ManagerState | null {
  try {
    const parsed = JSON.parse(raw) as ManagerState;
    if (!parsed || !parsed.players || !parsed.clubs || !parsed.calendar) {
      return null;
    }
    return upgradeLoadedManagerState(parsed);
  } catch {
    return null;
  }
}

export async function loadManagerState(
  slot: number | "auto" = 0
): Promise<ManagerState | null> {
  if (typeof window === "undefined") return null;

  const key = getSlotStorageKey(slot);

  try {
    const fromIdb = await idbGet(key);
    if (fromIdb) {
      const parsed = parseManagerStateRaw(fromIdb);
      if (parsed) return parsed;
    }
  } catch {
    /* fall through to localStorage */
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseManagerStateRaw(raw);
    // Migrate legacy localStorage blob into IndexedDB in the background
    if (parsed) {
      void saveManagerState(parsed, slot);
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Sync load for Node tests / environments without IndexedDB. */
export function loadManagerStateSync(slot: number | "auto" = 0): ManagerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getSlotStorageKey(slot));
    if (!raw) return null;
    return parseManagerStateRaw(raw);
  } catch {
    return null;
  }
}

/** Sync save for Node tests — always prunes; uses localStorage only. */
export function saveManagerStateSync(
  state: ManagerState,
  slot: number | "auto" = "auto"
): { success: boolean; error?: string } {
  if (typeof window === "undefined") {
    return { success: false, error: "Window unavailable" };
  }
  try {
    const key = getSlotStorageKey(slot);
    const pruned = pruneManagerStateForStorage(state);
    const serialized = JSON.stringify(pruned);
    window.localStorage.setItem(key, serialized);
    if (slot !== "auto") {
      window.localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
    }
    writeMeta(slot, buildSaveMetadata(pruned, slot));
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Storage write failed (quota exceeded)",
    };
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
        /* fallback */
      }
    }
    return null;
  } catch {
    return null;
  }
}

function clearSlotLocalMeta(slot: number | "auto"): void {
  if (typeof window === "undefined") return;
  const key = getSlotStorageKey(slot);
  window.localStorage.removeItem(key);
  window.localStorage.removeItem(`${key}-meta`);
  if (slot !== "auto") {
    const active = window.localStorage.getItem(ACTIVE_SLOT_KEY);
    if (active === String(slot)) {
      window.localStorage.removeItem(ACTIVE_SLOT_KEY);
    }
  }
}

export async function deleteSaveSlot(slot: number | "auto"): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const key = getSlotStorageKey(slot);
    try {
      await idbDelete(key);
    } catch {
      /* ignore */
    }
    clearSlotLocalMeta(slot);
    return true;
  } catch {
    return false;
  }
}

/** Sync delete for Node tests — localStorage only. */
export function deleteSaveSlotSync(slot: number | "auto"): boolean {
  if (typeof window === "undefined") return false;
  try {
    clearSlotLocalMeta(slot);
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
    if (meta) list.push(meta);
  }
  return list;
}

export function getMostRecentSave(): SaveMetadata | null {
  const all = getAllAvailableSaves();
  if (all.length === 0) return null;
  all.sort((a, b) => (b.savedAtTimestamp || 0) - (a.savedAtTimestamp || 0));
  return all[0];
}

export function exportSaveToJson(state: ManagerState): string {
  return JSON.stringify(pruneManagerStateForStorage(state), null, 2);
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
