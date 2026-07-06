import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import {
  sanitizeManagerStats,
} from "../manager/managerStats";
import type { ManagerLifetimeStats } from "../manager/types";

const STAT_KEY = "manager_career";
const MODE = "MANAGER";

export async function loadCloudManagerStats(): Promise<ManagerLifetimeStats | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", MODE)
      .eq("stat_key", STAT_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!data?.stat_json) return null;

    return sanitizeManagerStats(
      data.stat_json as Partial<ManagerLifetimeStats>
    );
  } catch (err) {
    console.error("[manager-stats-cloud] load failed:", err);
    return null;
  }
}

export async function saveCloudManagerStats(
  stats: ManagerLifetimeStats
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  const sanitized = sanitizeManagerStats(stats);

  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: MODE,
        stat_key: STAT_KEY,
        stat_value: sanitized.seasonsCompleted,
        stat_json: sanitized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[manager-stats-cloud] save failed:", err);
  }
}
