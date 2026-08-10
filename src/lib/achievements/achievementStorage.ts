import { STORAGE_KEYS } from "../storage/keys";
import { isLoggedIn } from "../auth-session";

/**
 * Canonical one-time unlock ledger row.
 * `popupAcknowledged` is authoritative for whether the unlock toast may queue.
 */
export type UnlockedAchievement = {
  /** Achievement definition id. */
  id: string;
  unlockedAt: string;
  /** Stable id for this unlock event — never reused for the same achievement. */
  unlockEventId: string;
  popupAcknowledged: boolean;
  rewardClaimed?: boolean;
};

export const ACHIEVEMENTS_CHANGED_EVENT = "27-0-achievements-changed";

function createUnlockEventId(achievementId: string, unlockedAt: string): string {
  return `ach-unlock:${achievementId}:${unlockedAt}`;
}

function normalizeRow(raw: unknown): UnlockedAchievement | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.unlockedAt !== "string") {
    return null;
  }

  const hasAckField =
    "popupAcknowledged" in row || "popupSeen" in row;
  // Pre-ack-field legacy rows were already earned — never replay.
  // Explicit false (or missing true) stays unacked until acknowledge().
  const popupAcknowledged = hasAckField
    ? row.popupAcknowledged === true || row.popupSeen === true
    : true;

  const unlockEventId =
    typeof row.unlockEventId === "string" && row.unlockEventId.length > 0
      ? row.unlockEventId
      : createUnlockEventId(row.id, row.unlockedAt);

  return {
    id: row.id,
    unlockedAt: row.unlockedAt,
    unlockEventId,
    popupAcknowledged,
    rewardClaimed: row.rewardClaimed === true,
  };
}

function loadRaw(): UnlockedAchievement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.achievements);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const byId = new Map<string, UnlockedAchievement>();
    for (const item of parsed) {
      const row = normalizeRow(item);
      if (!row) continue;
      // Never unlock twice — first row wins.
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    return Array.from(byId.values());
  } catch {
    return [];
  }
}

function saveRaw(rows: UnlockedAchievement[], syncCloud = true): void {
  if (typeof window === "undefined") return;
  // Dedupe by achievement id before persist.
  const byId = new Map<string, UnlockedAchievement>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  const next = Array.from(byId.values());
  localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ACHIEVEMENTS_CHANGED_EVENT));
  if (syncCloud && isLoggedIn()) {
    void import("../storage/achievements-cloud").then(({ saveCloudAchievements }) =>
      saveCloudAchievements(next)
    );
  }
}

export function loadAchievements(): UnlockedAchievement[] {
  return loadRaw();
}

export function saveAchievements(rows: UnlockedAchievement[]): void {
  saveRaw(rows);
}

/** Apply a merged ledger without re-uploading during hydrate (caller uploads once). */
export function replaceAchievementsFromCloudMerge(
  rows: UnlockedAchievement[]
): void {
  saveRaw(rows, false);
}

export function isAchievementUnlocked(id: string): boolean {
  return loadRaw().some((row) => row.id === id);
}

export function getUnlockedAchievement(
  id: string
): UnlockedAchievement | undefined {
  return loadRaw().find((row) => row.id === id);
}

export function isAchievementPopupAcknowledged(id: string): boolean {
  return getUnlockedAchievement(id)?.popupAcknowledged === true;
}

export { createUnlockEventId };

/** Hydrate local ledger from cloud, then push the merged result back. */
export async function refreshAchievementsFromCloud(): Promise<void> {
  const {
    loadCloudAchievements,
    mergeAchievementLedgers,
    saveCloudAchievements,
  } = await import("../storage/achievements-cloud");
  const cloud = await loadCloudAchievements();
  if (cloud == null) {
    // No cloud row yet — upload local ledger if any.
    const local = loadRaw();
    if (local.length > 0 && isLoggedIn()) {
      await saveCloudAchievements(local);
    }
    return;
  }
  const merged = mergeAchievementLedgers(loadRaw(), cloud);
  replaceAchievementsFromCloudMerge(merged);
  await saveCloudAchievements(merged);
  // Re-run progress baseline so stats-backed unlocks still apply after merge.
  const { synchronizeAchievementBaseline } = await import("./achievementEngine");
  synchronizeAchievementBaseline();
}
