/**
 * Cloud sync for Manager Mode careers (signed-in accounts only).
 * Stores pruned slot JSON in user_stats so desktop and mobile share the same slots.
 */

import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import type { ManagerState } from "./types";
import {
  ensureSlotMetadata,
  isManagerLocalPersistInFlight,
  loadManagerState,
  pruneManagerStateForStorage,
  saveManagerState,
  type SaveMetadata,
} from "./storage";

const STAT_MODE = "MANAGER";

export type ManagerSaveSlot = 0 | 1 | 2 | "auto";

const ALL_SLOTS: ManagerSaveSlot[] = [0, 1, 2, "auto"];

/** keepalive fetch body limit (Chrome ~64KB); larger saves fall back to async push. */
const KEEPALIVE_MAX_BODY_CHARS = 60_000;

function slotStatKey(slot: ManagerSaveSlot): string {
  return slot === "auto" ? "manager_autosave" : `manager_slot_${slot}`;
}

export interface CloudManagerSaveBundle {
  meta: SaveMetadata;
  state: ManagerState;
}

function metaTimestamp(meta: SaveMetadata | null | undefined): number {
  if (!meta) return 0;
  if (typeof meta.savedAtTimestamp === "number" && meta.savedAtTimestamp > 0) {
    return meta.savedAtTimestamp;
  }
  const parsed = Date.parse(meta.savedAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Season/week progress — used when meta timestamps are missing (common on mobile). */
function careerProgress(state: ManagerState | null | undefined): number {
  if (!state?.calendar) return 0;
  const season = state.calendar.currentSeason || 0;
  const week = state.calendar.currentWeek || 0;
  return season * 1000 + week;
}

export async function pushManagerSaveToCloud(
  slot: number | "auto",
  state: ManagerState,
  meta: SaveMetadata
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  const normalizedSlot: ManagerSaveSlot =
    slot === "auto" ? "auto" : ([0, 1, 2].includes(slot) ? (slot as 0 | 1 | 2) : 0);

  try {
    const pruned = pruneManagerStateForStorage(state);
    const bundle: CloudManagerSaveBundle = { meta, state: pruned };
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: slotStatKey(normalizedSlot),
        stat_value: meta.savedAtTimestamp || Date.now(),
        stat_json: bundle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[manager-saves-cloud] push failed:", err);
  }
}

export async function deleteManagerSaveFromCloud(
  slot: number | "auto"
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  const normalizedSlot: ManagerSaveSlot =
    slot === "auto" ? "auto" : ([0, 1, 2].includes(slot) ? (slot as 0 | 1 | 2) : 0);

  try {
    const { error } = await supabase
      .from("user_stats")
      .delete()
      .eq("user_id", userId)
      .eq("mode", STAT_MODE)
      .eq("stat_key", slotStatKey(normalizedSlot));
    if (error) throw error;
  } catch (err) {
    console.error("[manager-saves-cloud] delete failed:", err);
  }
}

async function loadCloudManagerSave(
  slot: ManagerSaveSlot
): Promise<CloudManagerSaveBundle | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", STAT_MODE)
      .eq("stat_key", slotStatKey(slot))
      .maybeSingle();

    if (error) throw error;
    if (!data?.stat_json || typeof data.stat_json !== "object") return null;

    const json = data.stat_json as Partial<CloudManagerSaveBundle>;
    if (!json.state?.players || !json.state?.clubs || !json.state?.calendar) {
      return null;
    }
    if (!json.meta?.clubName) return null;
    return { meta: json.meta as SaveMetadata, state: json.state as ManagerState };
  } catch (err) {
    console.error("[manager-saves-cloud] load failed:", err);
    return null;
  }
}

/** Single-flight mutex for bidirectional sync (auth hydrate + Club Select). */
let syncManagerSaveMutex: Promise<unknown> = Promise.resolve();
let managerSaveSyncInFlight = false;

export function isManagerSaveSyncInFlight(): boolean {
  return managerSaveSyncInFlight;
}

/** Exit-to-menu flush so Club Select / auth hydrate do not race an in-flight autosave. */
let managerExitFlushPromise: Promise<void> | null = null;

export function beginManagerExitFlush(work: () => Promise<void>): Promise<void> {
  const p = work().finally(() => {
    if (managerExitFlushPromise === p) {
      managerExitFlushPromise = null;
    }
  });
  managerExitFlushPromise = p;
  return p;
}

export async function awaitManagerExitFlush(): Promise<void> {
  const p = managerExitFlushPromise;
  if (!p) return;
  try {
    await p;
  } catch {
    /* local/cloud best-effort */
  }
}

export function getManagerPersistGate(): {
  syncInFlight: boolean;
  localPersistInFlight: boolean;
  exitFlushPending: boolean;
} {
  return {
    syncInFlight: managerSaveSyncInFlight,
    localPersistInFlight: isManagerLocalPersistInFlight(),
    exitFlushPending: managerExitFlushPromise != null,
  };
}

async function waitBrieflyForLocalPersist(maxMs = 750): Promise<boolean> {
  const start = Date.now();
  while (isManagerLocalPersistInFlight() && Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 40));
  }
  return !isManagerLocalPersistInFlight();
}

/**
 * Bidirectional sync: cloud wins when newer; otherwise upload local.
 * Never wipes a local IDB career just because localStorage meta is missing.
 * Returns how many slots were written locally from cloud (UI refresh signal).
 */
async function syncManagerSavesWithCloudInner(options?: {
  skipPull?: boolean;
}): Promise<{
  pulled: number;
  pushed: number;
}> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) {
    return { pulled: 0, pushed: 0 };
  }

  const skipPull = options?.skipPull === true;
  let pulled = 0;
  let pushed = 0;

  for (const slot of ALL_SLOTS) {
    const cloud = await loadCloudManagerSave(slot);
    const localState = await loadManagerState(slot);
    // Rebuild meta from IDB when localStorage meta was lost (Safari / low storage)
    const localMeta = await ensureSlotMetadata(slot);
    const cloudTs = metaTimestamp(cloud?.meta);
    const localTs = metaTimestamp(localMeta);
    const localProg = careerProgress(localState);
    const cloudProg = careerProgress(cloud?.state);

    // Local exists, cloud newer by timestamp — still protect if local calendar is ahead
    if (cloud && cloudTs > localTs) {
      if (skipPull) {
        if (localState && localMeta) {
          await pushManagerSaveToCloud(slot, localState, localMeta);
          pushed++;
        }
        continue;
      }
      if (localState && localProg > cloudProg) {
        if (localMeta) {
          await pushManagerSaveToCloud(slot, localState, localMeta);
          pushed++;
        }
        continue;
      }
      // Missing local meta used to force localTs=0 and wipe newer local IDB
      if (localState && localTs === 0 && localProg >= cloudProg) {
        if (localMeta) {
          await pushManagerSaveToCloud(slot, localState, localMeta);
          pushed++;
        }
        continue;
      }
      const res = await saveManagerState(cloud.state, slot, { skipCloud: true });
      if (res.success) pulled++;
      continue;
    }

    if (localState && localMeta && (!cloud || localTs > cloudTs)) {
      await pushManagerSaveToCloud(slot, localState, localMeta);
      pushed++;
      continue;
    }

    // Equal timestamps: ensure cloud has a copy if local exists but cloud missing
    if (localState && localMeta && !cloud) {
      await pushManagerSaveToCloud(slot, localState, localMeta);
      pushed++;
    }
  }

  return { pulled, pushed };
}

export async function syncManagerSavesWithCloud(): Promise<{
  pulled: number;
  pushed: number;
}> {
  const run = async () => {
    managerSaveSyncInFlight = true;
    try {
      await awaitManagerExitFlush();
      const localIdle = await waitBrieflyForLocalPersist();
      return await syncManagerSavesWithCloudInner({ skipPull: !localIdle });
    } finally {
      managerSaveSyncInFlight = false;
    }
  };

  const result = syncManagerSaveMutex.then(run, run) as Promise<{
    pulled: number;
    pushed: number;
  }>;
  syncManagerSaveMutex = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/** Fire-and-forget helper used after local writes. */
let autosaveCloudTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAutosavePush: { state: ManagerState; meta: SaveMetadata } | null = null;
/** Survives after debounce fires so pagehide can still push the last known autosave. */
let lastAutosaveForCloud: { state: ManagerState; meta: SaveMetadata } | null = null;

export function scheduleManagerCloudPush(
  slot: number | "auto",
  state: ManagerState,
  meta: SaveMetadata
): void {
  if (!getAuthUserId() || !isSupabaseConfigured) return;

  if (slot === "auto") {
    pendingAutosavePush = { state, meta };
    lastAutosaveForCloud = { state, meta };
    if (autosaveCloudTimer) clearTimeout(autosaveCloudTimer);
    autosaveCloudTimer = setTimeout(() => {
      autosaveCloudTimer = null;
      const pending = pendingAutosavePush;
      pendingAutosavePush = null;
      if (pending) {
        void pushManagerSaveToCloud("auto", pending.state, pending.meta);
      }
    }, 2500);
    return;
  }

  void pushManagerSaveToCloud(slot, state, meta);
}

function readSupabaseAccessTokenSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        currentSession?: { access_token?: string };
      };
      const token = parsed.access_token || parsed.currentSession?.access_token;
      if (typeof token === "string" && token.length > 0) return token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Best-effort keepalive upsert for small payloads. Returns false when not used
 * (too large / no token / not configured) so callers can fall back to async push.
 */
function tryKeepaliveManagerAutosavePush(
  state: ManagerState,
  meta: SaveMetadata
): boolean {
  if (typeof window === "undefined" || typeof fetch === "undefined") return false;
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !anonKey) return false;

  const accessToken = readSupabaseAccessTokenSync();
  if (!accessToken) return false;

  const pruned = pruneManagerStateForStorage(state);
  const row = {
    user_id: userId,
    mode: STAT_MODE,
    stat_key: slotStatKey("auto"),
    stat_value: meta.savedAtTimestamp || Date.now(),
    stat_json: { meta, state: pruned } satisfies CloudManagerSaveBundle,
    updated_at: new Date().toISOString(),
  };
  const body = JSON.stringify(row);
  if (body.length > KEEPALIVE_MAX_BODY_CHARS) return false;

  try {
    void fetch(`${supabaseUrl}/rest/v1/user_stats?on_conflict=user_id,mode,stat_key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "resolution=merge-duplicates",
      },
      body,
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}

function takePendingAutosaveForFlush(): {
  state: ManagerState;
  meta: SaveMetadata;
} | null {
  if (autosaveCloudTimer) {
    clearTimeout(autosaveCloudTimer);
    autosaveCloudTimer = null;
  }
  const pending = pendingAutosavePush || lastAutosaveForCloud;
  pendingAutosavePush = null;
  return pending;
}

/**
 * Sync kickoff for visibility/pagehide — no dynamic import, no await.
 * Uses fetch keepalive when the payload fits; otherwise fires async push.
 */
export function flushManagerCloudAutosaveSync(): void {
  const pending = takePendingAutosaveForFlush();
  if (!pending) return;
  if (tryKeepaliveManagerAutosavePush(pending.state, pending.meta)) return;
  void pushManagerSaveToCloud("auto", pending.state, pending.meta);
}

/**
 * Immediate cloud flush for autosave — call on exit (can await).
 * Cancels the 2.5s debounce so iOS backgrounding does not drop the push.
 */
export async function flushManagerCloudAutosave(): Promise<void> {
  const pending = takePendingAutosaveForFlush();
  if (!pending) return;
  if (tryKeepaliveManagerAutosavePush(pending.state, pending.meta)) return;
  await pushManagerSaveToCloud("auto", pending.state, pending.meta);
}
