/** Increment when save shape or migration logic changes. */
export const MANAGER_SAVE_VERSION = 1;

export function stampManagerSaveVersion<T extends { saveVersion?: number }>(
  career: T
): T & { saveVersion: number } {
  return { ...career, saveVersion: MANAGER_SAVE_VERSION };
}
