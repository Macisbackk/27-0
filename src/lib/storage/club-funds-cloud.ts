import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";

const STAT_MODE = "GLOBAL";
const STAT_KEY = "club_funds";

interface ClubFundsState {
  balance: number;
  paidRunIds: string[];
}

export async function loadCloudClubFunds(): Promise<ClubFundsState | null> {
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

    const json = data.stat_json as Partial<ClubFundsState>;
    return {
      balance:
        typeof json.balance === "number" && json.balance >= 0 ? json.balance : 0,
      paidRunIds: Array.isArray(json.paidRunIds)
        ? json.paidRunIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch (err) {
    console.error("[club-funds-cloud] load failed:", err);
    return null;
  }
}

export async function saveCloudClubFunds(state: ClubFundsState): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: state.balance,
        stat_json: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[club-funds-cloud] save failed:", err);
  }
}
