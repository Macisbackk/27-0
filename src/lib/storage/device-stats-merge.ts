import { STORAGE_KEYS } from "./keys";

/** Device stats backed up to the cloud since v1.66 (see device-stats-cloud.ts). Pure: no network. */
export const DEVICE_STATS_KEYS: readonly string[] = [
  STORAGE_KEYS.quizStats,
  STORAGE_KEYS.wordleStats,
  STORAGE_KEYS.gridStats,
  STORAGE_KEYS.hangmanStats,
  STORAGE_KEYS.higherLowerStats,
  STORAGE_KEYS.modeRecords,
];

export type DeviceStatsBundle = Record<string, unknown>;

const ACTIVITY_FIELDS = new Set(["played", "runs", "seasons", "gamesPlayed", "totalPlayed", "attempts"]);

/**
 * How much history a stored value holds: the sum of every "played"-like count in it (nested
 * objects included). Used to decide which side of a merge to keep.
 */
export function activityScore(value: unknown, depth = 0): number {
  if (!value || typeof value !== "object" || depth > 4) return 0;
  let total = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && ACTIVITY_FIELDS.has(k)) total += Math.max(0, v);
    else if (v && typeof v === "object") total += activityScore(v, depth + 1);
  }
  return total;
}

/** Per key: keep the side with more recorded activity; ties keep local. Pure, for tests. */
export function mergeDeviceStats(
  local: DeviceStatsBundle,
  cloud: DeviceStatsBundle | null
): { merged: DeviceStatsBundle; takeFromCloud: string[]; pushNeeded: boolean } {
  const merged: DeviceStatsBundle = { ...local };
  const takeFromCloud: string[] = [];
  let pushNeeded = !cloud;
  for (const key of DEVICE_STATS_KEYS) {
    const l = local[key];
    const c = cloud?.[key];
    if (c === undefined || c === null) {
      if (l !== undefined && l !== null) pushNeeded = true;
      continue;
    }
    if (l === undefined || l === null || activityScore(c) > activityScore(l)) {
      merged[key] = c;
      takeFromCloud.push(key);
    } else if (activityScore(l) > activityScore(c) || JSON.stringify(l) !== JSON.stringify(c)) {
      pushNeeded = true;
    }
  }
  return { merged, takeFromCloud, pushNeeded };
}

