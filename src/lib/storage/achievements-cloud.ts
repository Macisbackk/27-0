import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import type { UnlockedAchievement } from "../achievements/achievementStorage";

const STAT_MODE = "GLOBAL";
const STAT_KEY = "achievements";

export type AchievementsCloudState = {
  unlocked: UnlockedAchievement[];
};

function normalizeCloudRows(raw: unknown): UnlockedAchievement[] {
  if (!raw || typeof raw !== "object") return [];
  const unlocked = (raw as AchievementsCloudState).unlocked;
  if (!Array.isArray(unlocked)) return [];
  const byId = new Map<string, UnlockedAchievement>();
  for (const item of unlocked) {
    if (!item || typeof item !== "object") continue;
    const row = item as UnlockedAchievement;
    if (typeof row.id !== "string" || typeof row.unlockedAt !== "string") {
      continue;
    }
    if (byId.has(row.id)) continue;
    byId.set(row.id, {
      id: row.id,
      unlockedAt: row.unlockedAt,
      unlockEventId:
        typeof row.unlockEventId === "string" && row.unlockEventId.length > 0
          ? row.unlockEventId
          : `ach-unlock:${row.id}:${row.unlockedAt}`,
      popupAcknowledged: row.popupAcknowledged === true,
      rewardClaimed: row.rewardClaimed === true,
    });
  }
  return Array.from(byId.values());
}

/** Union ledgers: earliest unlock wins; never clear ack/reward flags. */
export function mergeAchievementLedgers(
  local: UnlockedAchievement[],
  cloud: UnlockedAchievement[]
): UnlockedAchievement[] {
  const byId = new Map<string, UnlockedAchievement>();

  const consider = (row: UnlockedAchievement) => {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, { ...row });
      return;
    }
    const earlier =
      Date.parse(row.unlockedAt) < Date.parse(existing.unlockedAt)
        ? row
        : existing;
    const later = earlier === row ? existing : row;
    byId.set(row.id, {
      id: earlier.id,
      unlockedAt: earlier.unlockedAt,
      unlockEventId: earlier.unlockEventId || later.unlockEventId,
      popupAcknowledged:
        earlier.popupAcknowledged === true || later.popupAcknowledged === true,
      rewardClaimed:
        earlier.rewardClaimed === true || later.rewardClaimed === true,
    });
  };

  for (const row of local) consider(row);
  for (const row of cloud) consider(row);
  return Array.from(byId.values());
}

export async function loadCloudAchievements(): Promise<UnlockedAchievement[] | null> {
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
    return normalizeCloudRows(data.stat_json);
  } catch (err) {
    console.error("[achievements-cloud] load failed:", err);
    return null;
  }
}

export async function saveCloudAchievements(
  unlocked: UnlockedAchievement[]
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;

  try {
    const payload: AchievementsCloudState = { unlocked };
    const { error } = await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: unlocked.length,
        stat_json: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("[achievements-cloud] save failed:", err);
  }
}
