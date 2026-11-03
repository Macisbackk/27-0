import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import { STORAGE_KEYS } from "./keys";
import { DEVICE_STATS_CHANGED_EVENT } from "./device-stats-events";
import { DEVICE_STATS_KEYS, mergeDeviceStats, type DeviceStatsBundle } from "./device-stats-merge";

export { DEVICE_STATS_CHANGED_EVENT, notifyDeviceStatsChanged } from "./device-stats-events";

/**
 * Cloud backup for stats that used to live on one device only: the mini-game records
 * (Quiz, Wordle, Grid, Hangman, Higher or Lower) and the One-Club XI / Gauntlet bests.
 * Before v1.66 these were lost when a player signed in on a new phone.
 *
 * One user_stats row (GLOBAL / device_stats_bundle) holds them all. On sign-in each key is
 * merged on its own: the side with more games recorded wins, so a fresh device never wipes
 * a long history and a newer, busier device is never overwritten by an older backup.
 */
const STAT_MODE = "GLOBAL";
const STAT_KEY = "device_stats_bundle";


function readLocalBundle(): DeviceStatsBundle {
  const out: DeviceStatsBundle = {};
  if (typeof window === "undefined") return out;
  for (const key of DEVICE_STATS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) out[key] = JSON.parse(raw);
    } catch {
      // unreadable value: leave it out (never upload junk)
    }
  }
  return out;
}

async function loadCloud(): Promise<{ ok: boolean; bundle: DeviceStatsBundle | null }> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return { ok: false, bundle: null };
  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", STAT_MODE)
      .eq("stat_key", STAT_KEY)
      .maybeSingle();
    if (error) throw error;
    const json = data?.stat_json;
    return { ok: true, bundle: json && typeof json === "object" ? (json as DeviceStatsBundle) : null };
  } catch (err) {
    console.error("[device-stats] cloud load failed:", err);
    return { ok: false, bundle: null };
  }
}

async function saveCloud(bundle: DeviceStatsBundle): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  if (Object.keys(bundle).length === 0) return;
  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: Math.min(2_147_483_647, Math.floor(Date.now() / 1000)),
        stat_json: bundle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[device-stats] cloud save failed:", err);
  }
}

let mergedForUser: string | null = null;

/** On sign-in: merge each key both ways. A failed read changes nothing and blocks pushes. */
export async function mergeDeviceStatsFromCloud(): Promise<void> {
  const userId = getAuthUserId();
  const { ok, bundle } = await loadCloud();
  if (!ok) return;
  const local = readLocalBundle();
  const { merged, takeFromCloud, pushNeeded } = mergeDeviceStats(local, bundle);
  for (const key of takeFromCloud) {
    try {
      localStorage.setItem(key, JSON.stringify(merged[key]));
    } catch {
      // storage full: keep going
    }
  }
  if (takeFromCloud.includes(STORAGE_KEYS.modeRecords)) {
    try {
      window.dispatchEvent(new CustomEvent("27-0-mode-records-changed"));
    } catch {
      // no-op
    }
  }
  mergedForUser = userId;
  if (pushNeeded) await saveCloud(merged);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function schedulePush(): void {
  // Never push before this account's cloud copy has been merged in (it could hold more).
  if (!mergedForUser || mergedForUser !== getAuthUserId()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void saveCloud(readLocalBundle());
  }, 4000);
}

/** Start listening for stats changes (idempotent). Call once on the client. */
export function startDeviceStatsSync(): void {
  if (typeof window === "undefined" || listening) return;
  listening = true;
  window.addEventListener(DEVICE_STATS_CHANGED_EVENT, schedulePush);
  window.addEventListener("27-0-mode-records-changed", schedulePush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer) {
      clearTimeout(timer);
      timer = null;
      void saveCloud(readLocalBundle());
    }
  });
}
