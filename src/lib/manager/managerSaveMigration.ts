import { STORAGE_KEYS } from "../storage/keys";
import { MANAGER_SAVE_VERSION } from "./managerSaveVersion";

const ACK_KEY = `${STORAGE_KEYS.managerActiveSlot}-save-version-ack`;

function loadAckedVersion(): number {
  if (typeof window === "undefined") return MANAGER_SAVE_VERSION;
  try {
    const raw = localStorage.getItem(ACK_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function acknowledgeSaveMigration(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACK_KEY, String(MANAGER_SAVE_VERSION));
}

/** True when a loaded save predates the current schema and the user has not dismissed the notice. */
export function shouldShowSaveMigrationNotice(
  previousSaveVersion: number | undefined
): boolean {
  const prev = previousSaveVersion ?? 0;
  if (prev >= MANAGER_SAVE_VERSION) return false;
  return loadAckedVersion() < MANAGER_SAVE_VERSION;
}
