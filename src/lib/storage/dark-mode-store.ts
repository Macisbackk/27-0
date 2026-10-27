import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import {
  applyDarkModeAttribute,
  DARK_MODE_CHANGED_EVENT,
  mergeDarkModePref,
  parseDarkModePref,
  readLocalDarkModePref,
  writeLocalDarkModePref,
  type DarkModePref,
} from "../ui/dark-mode";

/** Synced like the Store theme: one user_stats row (GLOBAL / ui_dark_mode), last write wins. */
const STAT_MODE = "GLOBAL";
const STAT_KEY = "ui_dark_mode";

export function isDarkModeOn(): boolean {
  return readLocalDarkModePref()?.on === true;
}

function applyLocal(pref: DarkModePref): void {
  writeLocalDarkModePref(pref);
  applyDarkModeAttribute(pref.on);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DARK_MODE_CHANGED_EVENT, { detail: { on: pref.on } }));
  }
}

export function setDarkMode(on: boolean): void {
  const pref: DarkModePref = { on, updatedAt: Date.now() };
  applyLocal(pref);
  void saveCloudDarkMode(pref);
}

/** `ok: false` = the read failed (offline, error): the caller must not touch anything. */
async function loadCloudDarkMode(): Promise<{ ok: boolean; pref: DarkModePref | null }> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return { ok: false, pref: null };
  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", STAT_MODE)
      .eq("stat_key", STAT_KEY)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, pref: parseDarkModePref(data?.stat_json ?? null) };
  } catch (err) {
    console.error("[dark-mode] cloud load failed:", err);
    return { ok: false, pref: null };
  }
}

async function saveCloudDarkMode(pref: DarkModePref): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: pref.on ? 1 : 0,
        stat_json: pref,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" },
    );
    if (error) throw error;
  } catch (err) {
    console.error("[dark-mode] cloud save failed:", err);
  }
}

/** On sign-in: newer side wins; a failed read changes nothing; a newer local choice is pushed up. */
export async function mergeDarkModeFromCloud(): Promise<void> {
  const { ok, pref: cloud } = await loadCloudDarkMode();
  if (!ok) return;
  const local = readLocalDarkModePref();
  const merged = mergeDarkModePref(local, cloud);
  if (!merged) return;
  if (merged === cloud && (local?.on !== cloud.on || local?.updatedAt !== cloud.updatedAt)) applyLocal(cloud);
  if (merged === local && (!cloud || cloud.on !== local.on || cloud.updatedAt !== local.updatedAt)) {
    await saveCloudDarkMode(local);
  }
}
