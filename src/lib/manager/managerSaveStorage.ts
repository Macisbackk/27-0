import { isLoggedIn } from "../auth-session";
import { STORAGE_KEYS } from "../storage/keys";
import type { ManagerCareer } from "./types";

export const MANAGER_SAVE_SLOT_COUNT = 3;

export interface ManagerSaveSlotSummary {
  slot: number;
  occupied: boolean;
  club?: string;
  seasonYear?: number;
  gameWeek?: number;
  updatedAt?: string;
}

let legacyMigrated = false;

function migrateLegacySaveIfNeeded(): void {
  if (legacyMigrated || typeof window === "undefined") return;
  legacyMigrated = true;

  const legacy = localStorage.getItem(STORAGE_KEYS.managerCareer);
  if (!legacy) return;

  for (let slot = 0; slot < MANAGER_SAVE_SLOT_COUNT; slot++) {
    if (!localStorage.getItem(STORAGE_KEYS.managerCareerSlot(slot))) {
      localStorage.setItem(STORAGE_KEYS.managerCareerSlot(slot), legacy);
      localStorage.removeItem(STORAGE_KEYS.managerCareer);
      return;
    }
  }

  console.warn(
    "[manager-save] Legacy career save found but all slots occupied — legacy key kept for manual recovery."
  );
}

export function getManagerCareerSlotKey(slot: number): string {
  return STORAGE_KEYS.managerCareerSlot(slot);
}

function getManagerCareerBackupKey(slot: number): string {
  return STORAGE_KEYS.managerCareerBackup(slot);
}

function isValidCareerShape(parsed: Partial<ManagerCareer>): parsed is ManagerCareer {
  return (
    typeof parsed === "object" &&
    parsed != null &&
    typeof parsed.club === "string" &&
    typeof parsed.seasonYear === "number" &&
    typeof parsed.seed === "string"
  );
}

function parseCareerJson(raw: string): ManagerCareer | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ManagerCareer>;
    return isValidCareerShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stampUpdatedAt(career: ManagerCareer): ManagerCareer {
  return { ...career, updatedAt: new Date().toISOString() };
}

function mirrorManagerCareerBackup(career: ManagerCareer, slot: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      getManagerCareerBackupKey(slot),
      JSON.stringify(stampUpdatedAt(career))
    );
  } catch {
    // Best-effort — session backup must never block the main save path.
  }
}

function clearManagerCareerBackup(slot: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(getManagerCareerBackupKey(slot));
  } catch {
    // ignore
  }
}

function readBackupCareer(slot: number): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(getManagerCareerBackupKey(slot));
    if (!raw) return null;
    return parseCareerJson(raw);
  } catch {
    return null;
  }
}

export function getActiveSaveSlot(): number {
  if (typeof window === "undefined") return 0;
  migrateLegacySaveIfNeeded();
  const raw = localStorage.getItem(STORAGE_KEYS.managerActiveSlot);
  const parsed = raw != null ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= MANAGER_SAVE_SLOT_COUNT) {
    return 0;
  }
  return parsed;
}

export function setActiveSaveSlot(slot: number): void {
  if (typeof window === "undefined") return;
  if (slot < 0 || slot >= MANAGER_SAVE_SLOT_COUNT) return;
  localStorage.setItem(STORAGE_KEYS.managerActiveSlot, String(slot));
  if (isLoggedIn()) {
    void import("../storage/manager-career-cloud").then(({ saveCloudManagerActiveSlot }) =>
      saveCloudManagerActiveSlot(slot)
    );
  }
}

function readRawCareer(slot: number): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  migrateLegacySaveIfNeeded();
  try {
    const raw = localStorage.getItem(getManagerCareerSlotKey(slot));
    if (raw) {
      const parsed = parseCareerJson(raw);
      if (parsed) return parsed;
    }
  } catch {
    // Fall through to session backup.
  }

  const backup = readBackupCareer(slot);
  if (!backup) return null;

  // Recover localStorage from the session mirror when primary storage is missing.
  try {
    localStorage.setItem(
      getManagerCareerSlotKey(slot),
      JSON.stringify(stampUpdatedAt(backup))
    );
  } catch {
    // Still return backup so the career can load in-memory this session.
  }
  return backup;
}

export function summarizeManagerSaveSlot(slot: number): ManagerSaveSlotSummary {
  const career = readRawCareer(slot);
  if (!career) {
    return { slot, occupied: false };
  }
  return {
    slot,
    occupied: true,
    club: career.club,
    seasonYear: career.seasonYear,
    gameWeek: career.gameWeek ?? career.currentRound ?? 0,
    updatedAt: career.updatedAt,
  };
}

export function listManagerSaveSlots(): ManagerSaveSlotSummary[] {
  return Array.from({ length: MANAGER_SAVE_SLOT_COUNT }, (_, slot) =>
    summarizeManagerSaveSlot(slot)
  );
}

export function readManagerCareerRaw(slot?: number): ManagerCareer | null {
  return readRawCareer(slot ?? getActiveSaveSlot());
}

export function writeManagerCareerRaw(
  career: ManagerCareer,
  slot?: number
): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: true };
  const targetSlot = slot ?? getActiveSaveSlot();
  const stamped = stampUpdatedAt(career);
  const payload = JSON.stringify(stamped);

  mirrorManagerCareerBackup(stamped, targetSlot);

  try {
    localStorage.setItem(getManagerCareerSlotKey(targetSlot), payload);
    if (isLoggedIn()) {
      void import("../storage/manager-career-cloud").then(
        ({ scheduleManagerCareerCloudSave }) =>
          scheduleManagerCareerCloudSave(stamped, targetSlot)
      );
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === "QuotaExceededError"
        ? "Storage full — free space on this device and try again."
        : "Could not save your career. Check browser storage is enabled.";
    console.error("[manager-save] write failed:", err);
    return { ok: false, error: message };
  }
}

export function deleteManagerCareerRaw(slot?: number): void {
  if (typeof window === "undefined") return;
  const targetSlot = slot ?? getActiveSaveSlot();
  localStorage.removeItem(getManagerCareerSlotKey(targetSlot));
  clearManagerCareerBackup(targetSlot);
  if (isLoggedIn()) {
    void import("../storage/manager-career-cloud").then(({ deleteCloudManagerCareer }) =>
      deleteCloudManagerCareer(targetSlot)
    );
  }
}

export function hasManagerCareerInSlot(slot?: number): boolean {
  return readRawCareer(slot ?? getActiveSaveSlot()) != null;
}

export function hasAnyManagerCareer(): boolean {
  return listManagerSaveSlots().some((summary) => summary.occupied);
}
