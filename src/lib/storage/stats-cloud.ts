import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import type { GameDifficulty, UserStatsData } from "../types";
import { EMPTY_STATS, migrateUserStats } from "./stats";

const BUNDLE_KEY = "stats_bundle";

interface StoredStats {
  normal: UserStatsData;
  hard: UserStatsData;
  draftNormal: UserStatsData;
  draftHard: UserStatsData;
  fantasy: UserStatsData;
  eraCup: UserStatsData;
  eraNormal: UserStatsData;
}

export async function loadCloudStats(): Promise<StoredStats | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("mode, stat_json")
      .eq("user_id", userId)
      .eq("stat_key", BUNDLE_KEY);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const result: StoredStats = {
      normal: { ...EMPTY_STATS },
      hard: { ...EMPTY_STATS },
      draftNormal: { ...EMPTY_STATS },
      draftHard: { ...EMPTY_STATS },
      fantasy: { ...EMPTY_STATS },
      eraCup: { ...EMPTY_STATS },
      eraNormal: { ...EMPTY_STATS },
    };

    for (const row of data) {
      const mode = row.mode as string;
      if (mode === "NORMAL") {
        result.normal = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      } else if (mode === "HARD") {
        result.hard = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      } else if (mode === "DRAFT_NORMAL") {
        result.draftNormal = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      } else if (mode === "DRAFT_HARD") {
        result.draftHard = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      } else if (mode === "FANTASY") {
        result.fantasy = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      } else if (mode === "ERA_CUP") {
        result.eraCup = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      } else if (mode === "ERA_NORMAL") {
        result.eraNormal = migrateUserStats(
          (row.stat_json as Partial<UserStatsData>) ?? {}
        );
      }
    }

    return result;
  } catch (err) {
    console.error("[stats-cloud] load failed:", err);
    return null;
  }
}

export async function saveCloudStats(stats: StoredStats): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  const modes: Array<{ key: keyof StoredStats; mode: string }> = [
    { key: "normal", mode: "NORMAL" },
    { key: "hard", mode: "HARD" },
    { key: "draftNormal", mode: "DRAFT_NORMAL" },
    { key: "draftHard", mode: "DRAFT_HARD" },
    { key: "fantasy", mode: "FANTASY" },
    { key: "eraCup", mode: "ERA_CUP" },
    { key: "eraNormal", mode: "ERA_NORMAL" },
  ];

  try {
    for (const { key, mode } of modes) {
      const data = stats[key];
      const { error } = await supabase.from("user_stats").upsert(
        {
          user_id: userId,
          mode,
          stat_key: BUNDLE_KEY,
          stat_value: 0,
          stat_json: data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,mode,stat_key" }
      );
      if (error) throw error;
    }
  } catch (err) {
    console.error("[stats-cloud] save failed:", err);
  }
}

export async function importLocalStatsToCloud(
  local: StoredStats
): Promise<{ ok: boolean; error?: string }> {
  const userId = getAuthUserId();
  if (!userId) return { ok: false, error: "Log in to import stats." };

  try {
    await saveCloudStats(local);
    return { ok: true };
  } catch {
    return { ok: false, error: "Import failed." };
  }
}
