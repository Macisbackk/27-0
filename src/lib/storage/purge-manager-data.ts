import { STORAGE_KEYS } from "./keys";

const MANAGER_PURGE_FLAG = "27-0-manager-data-purged-v1";

const MANAGER_INDEXED_DBS = ["27-0-manager-saves"] as const;

const AD_HOC_KEYS = [
  "manager-show-achievement-popups",
  "managerTutorialDebug",
] as const;

function isManagerStorageKey(key: string): boolean {
  return (
    key.startsWith("27-0-manager") ||
    key.startsWith("manager_") ||
    AD_HOC_KEYS.includes(key as (typeof AD_HOC_KEYS)[number])
  );
}

function removeMatchingKeys(storage: Storage): void {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isManagerStorageKey(key)) toRemove.push(key);
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve();
      return;
    }
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Wipe leftover Manager Mode persistence so old saves cannot affect
 * remaining modes. Safe to call repeatedly.
 */
export function purgeManagerModeLocalData(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEYS.managerCareer);
    window.localStorage.removeItem(STORAGE_KEYS.managerSaveStorageMigrated);
    window.localStorage.removeItem(STORAGE_KEYS.managerStats);
    window.localStorage.removeItem(STORAGE_KEYS.managerLeaderboard);
    window.localStorage.removeItem(STORAGE_KEYS.managerActiveSlot);
    window.localStorage.removeItem(STORAGE_KEYS.managerOnboarding);
    for (const slot of [0, 1, 2]) {
      window.localStorage.removeItem(STORAGE_KEYS.managerCareerSlot(slot));
      window.localStorage.removeItem(STORAGE_KEYS.managerCareerMeta(slot));
    }
    removeMatchingKeys(window.localStorage);
    window.localStorage.setItem(MANAGER_PURGE_FLAG, "1");
  } catch {
    /* ignore quota / private-mode */
  }

  try {
    for (const slot of [0, 1, 2]) {
      window.sessionStorage.removeItem(STORAGE_KEYS.managerCareerBackup(slot));
    }
    removeMatchingKeys(window.sessionStorage);
  } catch {
    /* ignore */
  }

  void Promise.all(MANAGER_INDEXED_DBS.map(deleteIndexedDb));
}

export function hasPurgedManagerModeData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MANAGER_PURGE_FLAG) === "1";
  } catch {
    return false;
  }
}
