import { STORAGE_KEYS } from "../storage/keys";
import type { ManagerCareer } from "./types";

export const MANAGER_SAVE_SLOT_COUNT = 4;

const ACTIVE_SLOT_KEY = "27-0-manager-active-slot";

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

  if (!localStorage.getItem(STORAGE_KEYS.managerCareerSlot(0))) {
    localStorage.setItem(STORAGE_KEYS.managerCareerSlot(0), legacy);
  }
  localStorage.removeItem(STORAGE_KEYS.managerCareer);
}

export function getManagerCareerSlotKey(slot: number): string {
  return STORAGE_KEYS.managerCareerSlot(slot);
}

export function getActiveSaveSlot(): number {
  if (typeof window === "undefined") return 0;
  migrateLegacySaveIfNeeded();
  const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
  const parsed = raw != null ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= MANAGER_SAVE_SLOT_COUNT) {
    return 0;
  }
  return parsed;
}

export function setActiveSaveSlot(slot: number): void {
  if (typeof window === "undefined") return;
  if (slot < 0 || slot >= MANAGER_SAVE_SLOT_COUNT) return;
  localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
}

function readRawCareer(slot: number): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  migrateLegacySaveIfNeeded();
  try {
    const raw = localStorage.getItem(getManagerCareerSlotKey(slot));
    if (!raw) return null;
    return JSON.parse(raw) as ManagerCareer;
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
): void {
  if (typeof window === "undefined") return;
  const targetSlot = slot ?? getActiveSaveSlot();
  localStorage.setItem(
    getManagerCareerSlotKey(targetSlot),
    JSON.stringify({ ...career, updatedAt: new Date().toISOString() })
  );
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
