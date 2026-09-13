/**
 * Cloud sync for Manager Mode careers (signed-in accounts only).
 * Stores pruned slot JSON in user_stats so desktop and mobile share the same slots.
 */

import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import type { ManagerState } from "./types";
import {
  getSaveSlotMetadata,
  loadManagerState,
  pruneManagerStateForStorage,
  saveManagerState,
  type SaveMetadata,
} from "./storage";

const STAT_MODE = "MANAGER";

export type ManagerSaveSlot = 0 | 1 | 2 | "auto";

const ALL_SLOTS: ManagerSaveSlot[] = [0, 1, 2, "auto"];

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

/**
 * Bidirectional sync: cloud wins when newer; otherwise upload local.
 * Returns how many slots were written locally from cloud (UI refresh signal).
 */
export async function syncManagerSavesWithCloud(): Promise<{
  pulled: number;
  pushed: number;
}> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) {
    return { pulled: 0, pushed: 0 };
  }

  let pulled = 0;
  let pushed = 0;

  for (const slot of ALL_SLOTS) {
    const cloud = await loadCloudManagerSave(slot);
    const localMeta = getSaveSlotMetadata(slot);
    const localState = await loadManagerState(slot);
    const cloudTs = metaTimestamp(cloud?.meta);
    const localTs = metaTimestamp(localMeta);

    if (cloud && cloudTs > localTs) {
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

/** Fire-and-forget helper used after local writes. */
let autosaveCloudTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleManagerCloudPush(
  slot: number | "auto",
  state: ManagerState,
  meta: SaveMetadata
): void {
  if (!getAuthUserId() || !isSupabaseConfigured) return;

  if (slot === "auto") {
    if (autosaveCloudTimer) clearTimeout(autosaveCloudTimer);
    autosaveCloudTimer = setTimeout(() => {
      autosaveCloudTimer = null;
      void pushManagerSaveToCloud("auto", state, meta);
    }, 2500);
    return;
  }

  void pushManagerSaveToCloud(slot, state, meta);
}
