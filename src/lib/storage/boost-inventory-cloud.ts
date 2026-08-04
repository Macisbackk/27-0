import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import type { UserBoostInventory } from "../boosts/boostInventory";

const STAT_MODE = "GLOBAL";
const STAT_KEY = "boost_inventory";

export async function loadCloudBoostInventory(): Promise<UserBoostInventory | null> {
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
    return data.stat_json as UserBoostInventory;
  } catch (err) {
    console.error("[boost-inventory-cloud] load failed:", err);
    return null;
  }
}

export async function saveCloudBoostInventory(
  state: UserBoostInventory
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  try {
    const owned = Object.values(state.quantities).reduce((a, b) => a + b, 0);
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: owned,
        stat_json: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[boost-inventory-cloud] save failed:", err);
  }
}
