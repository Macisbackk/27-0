/** Increment when save shape or migration logic changes. */
export const MANAGER_SAVE_VERSION = 3;

/** Fan Mood + Fitness removal; availability simplified. */
export const SIMPLIFIED_PLAYER_SYSTEMS_VERSION = 1;

/**
 * Persistence backend version (IndexedDB blobs + localStorage pointers).
 * Bump when the staged-write / pointer protocol changes.
 */
export const SAVE_STORAGE_VERSION = 2;

export function stampManagerSaveVersion<T extends { saveVersion?: number }>(
  career: T
): T & { saveVersion: number } {
  return { ...career, saveVersion: MANAGER_SAVE_VERSION };
}

