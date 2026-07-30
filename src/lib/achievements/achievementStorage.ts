import { STORAGE_KEYS } from "../storage/keys";

export type UnlockedAchievement = {
  id: string;
  unlockedAt: string;
  popupSeen?: boolean;
  rewardClaimed?: boolean;
};

export const ACHIEVEMENTS_CHANGED_EVENT = "27-0-achievements-changed";

function loadRaw(): UnlockedAchievement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.achievements);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is UnlockedAchievement =>
          typeof row === "object" &&
          row !== null &&
          typeof (row as UnlockedAchievement).id === "string" &&
          typeof (row as UnlockedAchievement).unlockedAt === "string"
      )
      .map((row) => ({
        id: row.id,
        unlockedAt: row.unlockedAt,
        popupSeen: row.popupSeen === true,
        rewardClaimed: row.rewardClaimed === true,
      }));
  } catch {
    return [];
  }
}

function saveRaw(rows: UnlockedAchievement[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(ACHIEVEMENTS_CHANGED_EVENT));
}

export function loadAchievements(): UnlockedAchievement[] {
  return loadRaw();
}

export function saveAchievements(rows: UnlockedAchievement[]): void {
  saveRaw(rows);
}

export function isAchievementUnlocked(id: string): boolean {
  return loadRaw().some((row) => row.id === id);
}

export function getUnlockedAchievement(
  id: string
): UnlockedAchievement | undefined {
  return loadRaw().find((row) => row.id === id);
}
