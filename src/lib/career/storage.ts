/**
 * Manager Mode (v2) persistence: one career + the cross-career legacy.
 * Local first (works signed out), mirrored to Supabase `user_stats` when signed in.
 */
import { getAuthUserId } from "../auth-session";
import { isSupabaseConfigured, supabase } from "../supabase";
import { emptyLegacy, normalizeLegacy } from "./legacy";
import type { CareerLegacy, CareerState } from "./types";

export const SAVE_KEY = "27-0-career-v2-save";
export const LEGACY_KEY = "27-0-career-v2-legacy";
const CLOUD_MODE = "CAREER_V2";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[career] could not save ${key}:`, error);
    return false;
  }
}

/** Structural check before trusting a saved career (local or cloud). Bad saves are ignored, not loaded. */
export function isCareer(value: unknown): value is CareerState {
  const v = value as CareerState | null;
  if (!v || typeof v !== "object" || v.version !== 1) return false;
  if (typeof v.userClubId !== "string" || typeof v.seed !== "string") return false;
  if (!v.clubs || typeof v.clubs !== "object" || !v.clubs[v.userClubId]) return false;
  if (!v.players || typeof v.players !== "object") return false;
  if (!Array.isArray(v.calendar) || !v.calendar.every((m) => m && Array.isArray(m.fixtures))) return false;
  if (!Number.isInteger(v.matchdayIndex) || v.matchdayIndex < 0 || v.matchdayIndex > v.calendar.length) return false;
  if (!["season", "review", "departures", "transfers"].includes(v.phase)) return false;
  if (!v.tables || !Array.isArray(v.tables["super-league"]) || !Array.isArray(v.tables.championship)) return false;
  if (!Array.isArray(v.lineup) || !Array.isArray(v.challenges) || !Array.isArray(v.news) || !Array.isArray(v.history)) return false;
  if (!v.seasonTrack || typeof v.seasonTrack !== "object") return false;
  if (v.phase === "review" && !v.lastOutcome) return false;
  if (!Array.isArray(v.clubs[v.userClubId]!.squad) || !Number.isFinite(v.budget) || !Number.isFinite(v.prestige)) return false;
  return true;
}

export function loadLocalCareer(): CareerState | null {
  const s = readJson<CareerState>(SAVE_KEY);
  return isCareer(s) ? s : null;
}

export function saveLocalCareer(state: CareerState | null): boolean {
  if (typeof window === "undefined") return false;
  if (!state) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    return true;
  }
  return writeJson(SAVE_KEY, state);
}

export function loadLocalLegacy(): CareerLegacy {
  return normalizeLegacy(readJson<CareerLegacy>(LEGACY_KEY));
}

export function saveLocalLegacy(legacy: CareerLegacy): boolean {
  return writeJson(LEGACY_KEY, legacy);
}

/* ------------------------------------------------------------------- cloud */

async function pushRow(statKey: "save" | "legacy", json: unknown, updatedAt: number): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  const { error } = await supabase.from("user_stats").upsert(
    {
      user_id: userId,
      mode: CLOUD_MODE,
      stat_key: statKey,
      stat_value: updatedAt,
      stat_json: json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,mode,stat_key" }
  );
  if (error) throw error;
}

async function pullRow<T>(statKey: "save" | "legacy"): Promise<T | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("user_stats")
    .select("stat_json")
    .eq("user_id", userId)
    .eq("mode", CLOUD_MODE)
    .eq("stat_key", statKey)
    .maybeSingle();
  if (error) throw error;
  return (data?.stat_json as T | undefined) ?? null;
}

export async function pushCareerToCloud(state: CareerState | null, legacy: CareerLegacy): Promise<void> {
  try {
    await pushRow("legacy", legacy, legacy.updatedAt || Date.now());
    if (state) await pushRow("save", state, state.updatedAt);
    else await pushRow("save", null, Date.now());
  } catch (error) {
    console.error("[career] cloud push failed:", error);
  }
}

/** Merge cloud and local: newest career wins; legacy keeps the higher progress. */
export async function syncCareerFromCloud(
  local: CareerState | null,
  localLegacy: CareerLegacy
): Promise<{ state: CareerState | null; legacy: CareerLegacy; changed: boolean }> {
  try {
    const [cloudSave, cloudLegacyRaw] = await Promise.all([pullRow<CareerState>("save"), pullRow<CareerLegacy>("legacy")]);
    let state = local;
    let changed = false;
    if (isCareer(cloudSave) && (!local || cloudSave.updatedAt > local.updatedAt)) {
      state = cloudSave;
      changed = true;
    }
    let legacy = localLegacy;
    if (cloudLegacyRaw) {
      const cloudLegacy = normalizeLegacy(cloudLegacyRaw);
      if (cloudLegacy.lifetimeLegacyPoints > localLegacy.lifetimeLegacyPoints || (cloudLegacy.lifetimeLegacyPoints === localLegacy.lifetimeLegacyPoints && cloudLegacy.updatedAt > localLegacy.updatedAt)) {
        legacy = cloudLegacy;
        changed = true;
      }
    }
    return { state, legacy, changed };
  } catch (error) {
    console.error("[career] cloud sync failed:", error);
    return { state: local, legacy: localLegacy, changed: false };
  }
}

export { emptyLegacy };
