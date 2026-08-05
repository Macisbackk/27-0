import { isLoggedIn } from "../auth-session";
import { STORAGE_KEYS } from "../storage/keys";
import {
  createCareerBlobStore,
  MemoryCareerBlobStore,
  type CareerBlobRecord,
  type CareerBlobStore,
} from "./managerSaveBlobStore";
import { checksumString, utf16ByteLength } from "./managerSaveChecksum";
import { compactCareerForPersistence } from "./managerSaveCompact";
import { maybeLogSaveSizeDiagnostics } from "./managerSaveDiagnostics";
import { SAVE_STORAGE_VERSION } from "./managerSaveVersion";
import type { ManagerCareer } from "./types";

export { SAVE_STORAGE_VERSION } from "./managerSaveVersion";
export { MemoryCareerBlobStore } from "./managerSaveBlobStore";

export const MANAGER_SAVE_SLOT_COUNT = 3;

export interface ManagerSaveSlotSummary {
  slot: number;
  occupied: boolean;
  club?: string;
  seasonYear?: number;
  gameWeek?: number;
  updatedAt?: string;
}

export interface ManagerSaveSlotPointer {
  saveStorageVersion: 2;
  occupied: true;
  club: string;
  seasonYear: number;
  gameWeek: number;
  updatedAt: string;
  generationId: string;
  previousGenerationId?: string;
  checksum: string;
  byteLength: number;
}

type WriteResult = { ok: true } | { ok: false; error: string };
type SaveWriteInterrupt = "after-candidate" | "after-verify" | null;

const careerCache = new Map<number, ManagerCareer>();
const slotWriteQueues = new Map<number, Promise<WriteResult>>();
let blobStore: CareerBlobStore = createCareerBlobStore();
let blobStoreInjected = false;
let readyPromise: Promise<void> | null = null;
let legacySingleSaveChecked = false;
let generationCounter = 0;
let saveWriteInterrupt: SaveWriteInterrupt = null;

function validSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < MANAGER_SAVE_SLOT_COUNT;
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

function parsePointer(raw: string | null): ManagerSaveSlotPointer | null {
  if (!raw) return null;
  try {
    const pointer = JSON.parse(raw) as Partial<ManagerSaveSlotPointer>;
    return pointer.saveStorageVersion === SAVE_STORAGE_VERSION &&
      pointer.occupied === true &&
      typeof pointer.club === "string" &&
      typeof pointer.seasonYear === "number" &&
      typeof pointer.gameWeek === "number" &&
      typeof pointer.updatedAt === "string" &&
      typeof pointer.generationId === "string" &&
      typeof pointer.checksum === "string" &&
      typeof pointer.byteLength === "number"
      ? (pointer as ManagerSaveSlotPointer)
      : null;
  } catch {
    return null;
  }
}

function stampUpdatedAt(career: ManagerCareer): ManagerCareer {
  return { ...career, updatedAt: new Date().toISOString() };
}

function getManagerCareerMetaKey(slot: number): string {
  return STORAGE_KEYS.managerCareerMeta(slot);
}

export function getManagerCareerSlotKey(slot: number): string {
  return STORAGE_KEYS.managerCareerSlot(slot);
}

function getManagerCareerBackupKey(slot: number): string {
  return STORAGE_KEYS.managerCareerBackup(slot);
}

export function getManagerSaveSlotPointer(
  slot: number
): ManagerSaveSlotPointer | null {
  if (typeof window === "undefined" || !validSlot(slot)) return null;
  try {
    return parsePointer(localStorage.getItem(getManagerCareerMetaKey(slot)));
  } catch {
    return null;
  }
}

function mirrorManagerCareerBackup(career: ManagerCareer, slot: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(getManagerCareerBackupKey(slot), JSON.stringify(career));
  } catch {
    // Best-effort emergency copy.
  }
}

function readBackupCareer(slot: number): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(getManagerCareerBackupKey(slot));
    return raw ? parseCareerJson(raw) : null;
  } catch {
    return null;
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

function verifyRecord(
  record: CareerBlobRecord | null,
  expectedChecksum?: string
): ManagerCareer | null {
  if (
    !record ||
    checksumString(record.payload) !== record.checksum ||
    (expectedChecksum != null && record.checksum !== expectedChecksum)
  ) {
    return null;
  }
  return parseCareerJson(record.payload);
}

function nextGenerationId(slot: number): string {
  generationCounter++;
  return `slot-${slot}-gen-${generationCounter}-${Date.now()}`;
}

function pointerFor(
  career: ManagerCareer,
  generationId: string,
  checksum: string,
  payload: string,
  previous?: ManagerSaveSlotPointer | null
): ManagerSaveSlotPointer {
  return {
    saveStorageVersion: SAVE_STORAGE_VERSION,
    occupied: true,
    club: career.club,
    seasonYear: career.seasonYear,
    gameWeek: career.gameWeek ?? career.currentRound ?? 0,
    updatedAt: career.updatedAt ?? new Date().toISOString(),
    generationId,
    previousGenerationId: previous?.generationId,
    checksum,
    byteLength: utf16ByteLength(payload),
  };
}

function writeError(err: unknown): WriteResult {
  console.error("[manager-save] staged write failed:", err);
  return {
    ok: false,
    error:
      err instanceof DOMException && err.name === "QuotaExceededError"
        ? "Storage full — free space on this device and try again."
        : "Could not save your career. Check browser storage is enabled.",
  };
}

async function pruneGenerations(
  slot: number,
  pointer: ManagerSaveSlotPointer
): Promise<void> {
  const keep = new Set(
    [pointer.generationId, pointer.previousGenerationId].filter(
      (id): id is string => Boolean(id)
    )
  );
  const records = await blobStore.listBySlot(slot);
  await Promise.all(
    records
      .filter((record) => !keep.has(record.generationId))
      .map((record) => blobStore.delete(record.generationId))
  );
}

async function stagedWrite(
  career: ManagerCareer,
  slot: number
): Promise<WriteResult> {
  const compacted = stampUpdatedAt(compactCareerForPersistence(career));
  const payload = JSON.stringify(compacted);
  const checksum = checksumString(payload);
  const generationId = nextGenerationId(slot);
  const candidate: CareerBlobRecord = {
    generationId,
    slot,
    payload,
    checksum,
    createdAt: compacted.updatedAt ?? new Date().toISOString(),
  };

  maybeLogSaveSizeDiagnostics(compacted, `slot ${slot} staged write`);
  mirrorManagerCareerBackup(compacted, slot);

  try {
    await blobStore.put(candidate);
    if (saveWriteInterrupt === "after-candidate") {
      return { ok: false, error: "Simulated interruption after candidate write." };
    }

    const verified = verifyRecord(await blobStore.get(generationId), checksum);
    if (!verified) {
      await blobStore.delete(generationId);
      return { ok: false, error: "Save verification failed; previous save kept." };
    }
    if (saveWriteInterrupt === "after-verify") {
      return { ok: false, error: "Simulated interruption after verification." };
    }

    const previous = getManagerSaveSlotPointer(slot);
    const pointer = pointerFor(
      verified,
      generationId,
      checksum,
      payload,
      previous
    );
    localStorage.setItem(getManagerCareerMetaKey(slot), JSON.stringify(pointer));
    careerCache.set(slot, verified);
    await pruneGenerations(slot, pointer);

    if (isLoggedIn()) {
      void import("../storage/manager-career-cloud").then(
        ({ scheduleManagerCareerCloudSave }) =>
          scheduleManagerCareerCloudSave(verified, slot)
      );
    }
    return { ok: true };
  } catch (err) {
    try {
      await blobStore.delete(generationId);
    } catch {
      // Candidate cleanup is best-effort; it is never pointed to on failure.
    }
    return writeError(err);
  }
}

function queueStagedWrite(career: ManagerCareer, slot: number): Promise<WriteResult> {
  const previous = slotWriteQueues.get(slot) ?? Promise.resolve({ ok: true });
  const next = previous
    .catch(() => ({ ok: false as const, error: "Previous save failed." }))
    .then(() => stagedWrite(career, slot));
  slotWriteQueues.set(slot, next);
  void next.finally(() => {
    if (slotWriteQueues.get(slot) === next) slotWriteQueues.delete(slot);
  });
  return next;
}

function migrateDeprecatedSingleSave(): void {
  if (legacySingleSaveChecked || typeof window === "undefined") return;
  legacySingleSaveChecked = true;
  const legacy = localStorage.getItem(STORAGE_KEYS.managerCareer);
  if (!legacy) return;
  for (let slot = 0; slot < MANAGER_SAVE_SLOT_COUNT; slot++) {
    if (
      !getManagerSaveSlotPointer(slot) &&
      !localStorage.getItem(getManagerCareerSlotKey(slot))
    ) {
      localStorage.setItem(getManagerCareerSlotKey(slot), legacy);
      localStorage.removeItem(STORAGE_KEYS.managerCareer);
      return;
    }
  }
  console.warn(
    "[manager-save] Legacy career save found but all slots occupied — legacy key kept for manual recovery."
  );
}

async function loadPointerCareer(
  slot: number,
  pointer: ManagerSaveSlotPointer
): Promise<ManagerCareer | null> {
  const current = verifyRecord(
    await blobStore.get(pointer.generationId),
    pointer.checksum
  );
  if (current) return current;
  if (pointer.previousGenerationId) {
    const previous = verifyRecord(
      await blobStore.get(pointer.previousGenerationId)
    );
    if (previous) return previous;
  }
  return readBackupCareer(slot);
}

async function migrateLegacySlot(slot: number): Promise<void> {
  const raw = localStorage.getItem(getManagerCareerSlotKey(slot));
  const legacy = raw ? parseCareerJson(raw) : null;
  if (!legacy) return;
  const result = await queueStagedWrite(legacy, slot);
  if (result.ok) {
    localStorage.removeItem(getManagerCareerSlotKey(slot));
  }
}

async function initializeStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  migrateDeprecatedSingleSave();

  for (let slot = 0; slot < MANAGER_SAVE_SLOT_COUNT; slot++) {
    const pointer = getManagerSaveSlotPointer(slot);
    if (pointer) {
      const career = await loadPointerCareer(slot, pointer);
      if (career) careerCache.set(slot, career);
    }
    if (!careerCache.has(slot)) {
      await migrateLegacySlot(slot);
    } else if (localStorage.getItem(getManagerCareerSlotKey(slot))) {
      localStorage.removeItem(getManagerCareerSlotKey(slot));
    }
  }
  localStorage.setItem(STORAGE_KEYS.managerSaveStorageMigrated, "1");
}

export function ensureManagerSaveStorageReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = initializeStorage().catch(async (err) => {
      console.error("[manager-save] IndexedDB initialization failed:", err);
      if (!blobStoreInjected && !(blobStore instanceof MemoryCareerBlobStore)) {
        blobStore = new MemoryCareerBlobStore();
        careerCache.clear();
        await initializeStorage();
        return;
      }
      throw err;
    });
  }
  return readyPromise;
}

export function getActiveSaveSlot(): number {
  if (typeof window === "undefined") return 0;
  migrateDeprecatedSingleSave();
  const raw = localStorage.getItem(STORAGE_KEYS.managerActiveSlot);
  const parsed = raw != null ? parseInt(raw, 10) : 0;
  return validSlot(parsed) ? parsed : 0;
}

export function setActiveSaveSlot(slot: number): void {
  if (typeof window === "undefined" || !validSlot(slot)) return;
  localStorage.setItem(STORAGE_KEYS.managerActiveSlot, String(slot));
  if (isLoggedIn()) {
    void import("../storage/manager-career-cloud").then(
      ({ saveCloudManagerActiveSlot }) => saveCloudManagerActiveSlot(slot)
    );
  }
}

function readRawCareer(slot: number): ManagerCareer | null {
  if (typeof window === "undefined" || !validSlot(slot)) return null;
  migrateDeprecatedSingleSave();
  const cached = careerCache.get(slot);
  if (cached) return cached;

  const pointer = getManagerSaveSlotPointer(slot);
  if (pointer && blobStore instanceof MemoryCareerBlobStore) {
    const current = verifyRecord(blobStore.get(pointer.generationId), pointer.checksum);
    const previous =
      current || !pointer.previousGenerationId
        ? null
        : verifyRecord(blobStore.get(pointer.previousGenerationId));
    const recovered = current ?? previous;
    if (recovered) {
      careerCache.set(slot, recovered);
      return recovered;
    }
  }

  const legacyRaw = localStorage.getItem(getManagerCareerSlotKey(slot));
  const legacy = legacyRaw ? parseCareerJson(legacyRaw) : null;
  if (legacy) {
    void migrateLegacySlot(slot);
    return legacy;
  }
  return readBackupCareer(slot);
}

export function readManagerCareerRaw(slot?: number): ManagerCareer | null {
  return readRawCareer(slot ?? getActiveSaveSlot());
}

export async function writeManagerCareerRawAsync(
  career: ManagerCareer,
  slot?: number
): Promise<WriteResult> {
  if (typeof window === "undefined") return { ok: true };
  const targetSlot = slot ?? getActiveSaveSlot();
  if (!validSlot(targetSlot)) return { ok: false, error: "Invalid save slot." };
  return queueStagedWrite(career, targetSlot);
}

export function writeManagerCareerRaw(
  career: ManagerCareer,
  slot?: number
): WriteResult {
  if (typeof window === "undefined") return { ok: true };
  const targetSlot = slot ?? getActiveSaveSlot();
  if (!validSlot(targetSlot)) return { ok: false, error: "Invalid save slot." };

  if (blobStore instanceof MemoryCareerBlobStore) {
    let result: WriteResult = {
      ok: false,
      error: "Save is still being verified.",
    };
    const compacted = stampUpdatedAt(compactCareerForPersistence(career));
    const payload = JSON.stringify(compacted);
    const checksum = checksumString(payload);
    const generationId = nextGenerationId(targetSlot);
    const candidate: CareerBlobRecord = {
      generationId,
      slot: targetSlot,
      payload,
      checksum,
      createdAt: compacted.updatedAt!,
    };
    maybeLogSaveSizeDiagnostics(compacted, `slot ${targetSlot} staged write`);
    mirrorManagerCareerBackup(compacted, targetSlot);
    try {
      blobStore.put(candidate);
      if (saveWriteInterrupt === "after-candidate") {
        return { ok: false, error: "Simulated interruption after candidate write." };
      }
      const verified = verifyRecord(blobStore.get(generationId), checksum);
      if (!verified) {
        blobStore.delete(generationId);
        return { ok: false, error: "Save verification failed; previous save kept." };
      }
      if (saveWriteInterrupt === "after-verify") {
        return { ok: false, error: "Simulated interruption after verification." };
      }
      const previous = getManagerSaveSlotPointer(targetSlot);
      const pointer = pointerFor(
        verified,
        generationId,
        checksum,
        payload,
        previous
      );
      localStorage.setItem(
        getManagerCareerMetaKey(targetSlot),
        JSON.stringify(pointer)
      );
      careerCache.set(targetSlot, verified);
      const keep = new Set(
        [pointer.generationId, pointer.previousGenerationId].filter(
          (id): id is string => Boolean(id)
        )
      );
      for (const record of blobStore.listBySlot(targetSlot)) {
        if (!keep.has(record.generationId)) blobStore.delete(record.generationId);
      }
      result = { ok: true };
    } catch (err) {
      blobStore.delete(generationId);
      result = writeError(err);
    }
    if (result.ok && isLoggedIn()) {
      void import("../storage/manager-career-cloud").then(
        ({ scheduleManagerCareerCloudSave }) =>
          scheduleManagerCareerCloudSave(compacted, targetSlot)
      );
    }
    return result;
  }

  const prepared = stampUpdatedAt(compactCareerForPersistence(career));
  mirrorManagerCareerBackup(prepared, targetSlot);
  void queueStagedWrite(prepared, targetSlot).then((result) => {
    if (!result.ok) console.error(`[manager-save] ${result.error}`);
  });
  return { ok: true };
}

export function summarizeManagerSaveSlot(slot: number): ManagerSaveSlotSummary {
  const pointer = getManagerSaveSlotPointer(slot);
  if (pointer) {
    return {
      slot,
      occupied: true,
      club: pointer.club,
      seasonYear: pointer.seasonYear,
      gameWeek: pointer.gameWeek,
      updatedAt: pointer.updatedAt,
    };
  }
  const career = readRawCareer(slot);
  return career
    ? {
        slot,
        occupied: true,
        club: career.club,
        seasonYear: career.seasonYear,
        gameWeek: career.gameWeek ?? career.currentRound ?? 0,
        updatedAt: career.updatedAt,
      }
    : { slot, occupied: false };
}

export function listManagerSaveSlots(): ManagerSaveSlotSummary[] {
  return Array.from({ length: MANAGER_SAVE_SLOT_COUNT }, (_, slot) =>
    summarizeManagerSaveSlot(slot)
  );
}

export function deleteManagerCareerRaw(slot?: number): void {
  if (typeof window === "undefined") return;
  const targetSlot = slot ?? getActiveSaveSlot();
  const pointer = getManagerSaveSlotPointer(targetSlot);
  localStorage.removeItem(getManagerCareerMetaKey(targetSlot));
  localStorage.removeItem(getManagerCareerSlotKey(targetSlot));
  careerCache.delete(targetSlot);
  clearManagerCareerBackup(targetSlot);
  void Promise.resolve(blobStore.listBySlot(targetSlot)).then((records) =>
    Promise.all(records.map((record) => blobStore.delete(record.generationId)))
  );
  if (pointer) {
    void Promise.resolve(blobStore.delete(pointer.generationId));
  }
  if (isLoggedIn()) {
    void import("../storage/manager-career-cloud").then(
      ({ deleteCloudManagerCareer }) => deleteCloudManagerCareer(targetSlot)
    );
  }
}

export function hasManagerCareerInSlot(slot?: number): boolean {
  return readRawCareer(slot ?? getActiveSaveSlot()) != null;
}

export function hasAnyManagerCareer(): boolean {
  return listManagerSaveSlots().some((summary) => summary.occupied);
}

export function setCareerBlobStoreForTests(store: CareerBlobStore): void {
  blobStore = store;
  blobStoreInjected = true;
  careerCache.clear();
  slotWriteQueues.clear();
  readyPromise = null;
}

export function resetCareerBlobStoreForTests(): void {
  blobStore = createCareerBlobStore();
  blobStoreInjected = false;
  careerCache.clear();
  slotWriteQueues.clear();
  readyPromise = null;
  legacySingleSaveChecked = false;
  generationCounter = 0;
  saveWriteInterrupt = null;
}

export function setSaveWriteInterruptForTests(
  interrupt: SaveWriteInterrupt
): void {
  saveWriteInterrupt = interrupt;
}
