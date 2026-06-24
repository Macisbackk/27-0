import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import type { UiThemeStoreState } from "./ui-theme-store";

const STAT_MODE = "GLOBAL";
const STAT_KEY = "ui_theme_store";

export async function loadCloudUiThemeStore(): Promise<UiThemeStoreState | null> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("user_stats")
      .select("stat_json")
      .eq("user_id", userId)
      .eq("mode", STAT_MODE)
      .eq("stat_key", STAT_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!data?.stat_json) return null;
    return data.stat_json as UiThemeStoreState;
  } catch (err) {
    console.error("[ui-theme-store-cloud] load failed:", err);
    return null;
  }
}

export async function saveCloudUiThemeStore(state: UiThemeStoreState): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: state.unlockedThemeIds.length,
        stat_json: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[ui-theme-store-cloud] save failed:", err);
  }
}
