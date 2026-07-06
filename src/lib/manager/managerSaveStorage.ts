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
}

function readRawCareer(slot: number): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  migrateLegacySaveIfNeeded();
  try {
    const raw = localStorage.getItem(getManagerCareerSlotKey(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ManagerCareer>;
    if (
      typeof parsed !== "object" ||
      parsed == null ||
      typeof parsed.club !== "string" ||
      typeof parsed.seasonYear !== "number" ||
      typeof parsed.seed !== "string"
    ) {
      return null;
    }
    return parsed as ManagerCareer;
  } catch {
    return null;
  }
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
  try {
    const targetSlot = slot ?? getActiveSaveSlot();
    localStorage.setItem(
      getManagerCareerSlotKey(targetSlot),
      JSON.stringify({ ...career, updatedAt: new Date().toISOString() })
    );
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
  localStorage.removeItem(getManagerCareerSlotKey(slot ?? getActiveSaveSlot()));
}

export function hasManagerCareerInSlot(slot?: number): boolean {
  return readRawCareer(slot ?? getActiveSaveSlot()) != null;
}

export function hasAnyManagerCareer(): boolean {
  return listManagerSaveSlots().some((summary) => summary.occupied);
}
