import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId, isLoggedIn } from "../auth-session";
import type { ManagerCareer } from "../manager/types";
import {
  MANAGER_SAVE_SLOT_COUNT,
  getActiveSaveSlot,
  readManagerCareerRaw,
  setActiveSaveSlot,
  writeManagerCareerRaw,
  deleteManagerCareerRaw,
} from "../manager/managerSaveStorage";

const MODE = "MANAGER";
const ACTIVE_SLOT_KEY = "manager_active_slot";

export const MANAGER_SAVES_CHANGED_EVENT = "manager-saves-changed";

function careerSlotKey(slot: number): string {
  return `manager_save_slot_${slot}`;
}

function isValidCareerShape(parsed: Partial<ManagerCareer>): parsed is ManagerCareer {
  return (
    typeof parsed === "object" &&
    parsed != null &&
    typeof parsed.club === "string" &&
    typeof parsed.seasonYear === "number" &&
    typeof parsed.seed === "string"
  );
}

function parseCareerJson(json: unknown): ManagerCareer | null {
  if (!json || typeof json !== "object") return null;
  const parsed = json as Partial<ManagerCareer>;
  return isValidCareerShape(parsed) ? parsed : null;
}

function careerTimestamp(career: ManagerCareer | null): number {
  if (!career?.updatedAt) return 0;
  const parsed = Date.parse(career.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickNewerCareer(
  cloud: ManagerCareer | null,
  local: ManagerCareer | null
): ManagerCareer | null {
  if (!cloud) return local;
  if (!local) return cloud;
  return careerTimestamp(local) >= careerTimestamp(cloud) ? local : cloud;
}

export async function loadCloudManagerCareerSlot(
  slot: number
): Promise<ManagerCareer | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", MODE)
      .eq("stat_key", careerSlotKey(slot))
      .maybeSingle();

    if (error) throw error;
    if (!data?.stat_json) return null;
    return parseCareerJson(data.stat_json);
  } catch (err) {
    console.error("[manager-career-cloud] load slot failed:", err);
    return null;
  }
}

export async function saveCloudManagerCareerSlot(
  slot: number,
  career: ManagerCareer
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: MODE,
        stat_key: careerSlotKey(slot),
        stat_value: career.gameWeek ?? career.currentRound ?? 0,
        stat_json: career,
        updated_at: career.updatedAt ?? new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[manager-career-cloud] save slot failed:", err);
  }
}

export async function deleteCloudManagerCareerSlot(slot: number): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from("user_stats")
      .delete()
      .eq("user_id", userId)
      .eq("mode", MODE)
      .eq("stat_key", careerSlotKey(slot));
    if (error) throw error;
  } catch (err) {
    console.error("[manager-career-cloud] delete slot failed:", err);
  }
}

export async function loadCloudManagerActiveSlot(): Promise<number | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_value")
      .eq("user_id", userId)
      .eq("mode", MODE)
      .eq("stat_key", ACTIVE_SLOT_KEY)
      .maybeSingle();

    if (error) throw error;
    if (data?.stat_value == null) return null;
    const slot = Number(data.stat_value);
    if (!Number.isFinite(slot) || slot < 0 || slot >= MANAGER_SAVE_SLOT_COUNT) {
      return null;
    }
    return slot;
  } catch (err) {
    console.error("[manager-career-cloud] load active slot failed:", err);
    return null;
  }
}

export async function saveCloudManagerActiveSlot(slot: number): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  if (slot < 0 || slot >= MANAGER_SAVE_SLOT_COUNT) return;

  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: MODE,
        stat_key: ACTIVE_SLOT_KEY,
        stat_value: slot,
        stat_json: { slot },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[manager-career-cloud] save active slot failed:", err);
  }
}

function dispatchSavesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MANAGER_SAVES_CHANGED_EVENT));
}

let pendingCloudFlush: ReturnType<typeof setTimeout> | null = null;
let pendingCloudSave: { career: ManagerCareer; slot: number } | null = null;

export function scheduleManagerCareerCloudSave(
  career: ManagerCareer,
  slot: number
): void {
  if (!isLoggedIn()) return;
  pendingCloudSave = { career, slot };
  if (pendingCloudFlush) clearTimeout(pendingCloudFlush);
  pendingCloudFlush = setTimeout(() => {
    pendingCloudFlush = null;
    const pending = pendingCloudSave;
    pendingCloudSave = null;
    if (pending) {
      void saveCloudManagerCareerSlot(pending.slot, pending.career);
    }
  }, 2000);
}

export async function flushManagerCareerToCloud(
  career?: ManagerCareer | null,
  slot?: number
): Promise<void> {
  if (!isLoggedIn()) return;

  if (pendingCloudFlush) {
    clearTimeout(pendingCloudFlush);
    pendingCloudFlush = null;
  }

  const targetSlot = slot ?? getActiveSaveSlot();
  const toSave =
    career ??
    pendingCloudSave?.career ??
    readManagerCareerRaw(targetSlot);
  pendingCloudSave = null;

  if (toSave) {
    await saveCloudManagerCareerSlot(targetSlot, toSave);
  }

  await saveCloudManagerActiveSlot(getActiveSaveSlot());
}

export async function flushAllManagerCareersToCloud(): Promise<void> {
  if (!isLoggedIn()) return;

  if (pendingCloudFlush) {
    clearTimeout(pendingCloudFlush);
    pendingCloudFlush = null;
  }
  pendingCloudSave = null;

  const writes: Promise<void>[] = [];
  for (let slot = 0; slot < MANAGER_SAVE_SLOT_COUNT; slot++) {
    const career = readManagerCareerRaw(slot);
    if (career) {
      writes.push(saveCloudManagerCareerSlot(slot, career));
    }
  }
  writes.push(saveCloudManagerActiveSlot(getActiveSaveSlot()));
  await Promise.all(writes);
}

export async function refreshManagerCareersFromCloud(): Promise<boolean> {
  if (typeof window === "undefined" || !isLoggedIn()) return false;

  let changed = false;

  for (let slot = 0; slot < MANAGER_SAVE_SLOT_COUNT; slot++) {
    const cloud = await loadCloudManagerCareerSlot(slot);
    const local = readManagerCareerRaw(slot);
    const winner = pickNewerCareer(cloud, local);

    if (!winner) {
      continue;
    }

    const localTime = careerTimestamp(local);
    const cloudTime = careerTimestamp(cloud);
    const winnerTime = careerTimestamp(winner);

    if (!local || localTime < winnerTime) {
      writeManagerCareerRaw(winner, slot);
      changed = true;
    }

    if (!cloud || cloudTime < winnerTime) {
      await saveCloudManagerCareerSlot(slot, winner);
    }
  }

  const cloudActive = await loadCloudManagerActiveSlot();
  let resolvedActive = getActiveSaveSlot();
  let newestSlot: number | null = null;
  let newestTime = 0;
  for (let slot = 0; slot < MANAGER_SAVE_SLOT_COUNT; slot++) {
    const career = readManagerCareerRaw(slot);
    const time = careerTimestamp(career);
    if (time > newestTime) {
      newestTime = time;
      newestSlot = slot;
    }
  }
  if (newestSlot != null) {
    resolvedActive = newestSlot;
  } else if (cloudActive != null) {
    resolvedActive = cloudActive;
  }
  if (resolvedActive !== getActiveSaveSlot()) {
    setActiveSaveSlot(resolvedActive);
    changed = true;
  }
  await saveCloudManagerActiveSlot(getActiveSaveSlot());

  if (changed) {
    dispatchSavesChanged();
  }

  return true;
}

export async function deleteCloudManagerCareer(slot: number): Promise<void> {
  await deleteCloudManagerCareerSlot(slot);
}
