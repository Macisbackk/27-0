/**
 * IndexedDB save protocol smoke tests.
 * Run: npx tsx scripts/test-save-storage.ts
 */

import { STORAGE_KEYS } from "../src/lib/storage/keys";
import {
  ensureManagerSaveStorageReady,
  getManagerSaveSlotPointer,
  MemoryCareerBlobStore,
  readManagerCareerRaw,
  resetCareerBlobStoreForTests,
  setCareerBlobStoreForTests,
  setSaveWriteInterruptForTests,
  writeManagerCareerRaw,
} from "../src/lib/manager/managerSaveStorage";
import { measureCareerSaveSize } from "../src/lib/manager/managerSaveDiagnostics";
import type { ManagerCareer } from "../src/lib/manager/types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: local,
  sessionStorage: session,
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function career(
  club: string,
  seed: string,
  seasonYear = 2026,
  gameWeek = 0
): ManagerCareer {
  return {
    id: seed,
    club,
    seed,
    seasonYear,
    gameWeek,
    currentRound: gameWeek,
    fixtures: [],
    inboxMessages: [],
    latestNews: [],
    leagueTransfers: [],
  } as unknown as ManagerCareer;
}

function reset(): MemoryCareerBlobStore {
  local.clear();
  session.clear();
  resetCareerBlobStoreForTests();
  const store = new MemoryCareerBlobStore();
  setCareerBlobStoreForTests(store);
  setSaveWriteInterruptForTests(null);
  return store;
}

async function run(): Promise<void> {
  console.log("manager save storage v2\n");

  reset();
  const original = career("Wigan Warriors", "round-trip-seed", 2027, 4);
  const roundTripWrite = writeManagerCareerRaw(original, 0);
  const roundTrip = readManagerCareerRaw(0);
  assert(roundTripWrite.ok, "round-trip write succeeds");
  assert(
    roundTrip?.club === original.club &&
      roundTrip.seasonYear === 2027 &&
      roundTrip.seed === "round-trip-seed",
    "round-trip preserves club, season, and seed"
  );
  assert(
    roundTrip?.saveStorageVersion === 2,
    "compaction stamps saveStorageVersion 2"
  );
  assert(
    local.getItem(STORAGE_KEYS.managerCareerSlot(0)) === null &&
      getManagerSaveSlotPointer(0)?.saveStorageVersion === 2,
    "localStorage contains pointer metadata, not career JSON"
  );

  const oldPointer = getManagerSaveSlotPointer(0);
  setSaveWriteInterruptForTests("after-candidate");
  const interrupted = writeManagerCareerRaw(
    career("Leeds Rhinos", "interrupted-seed", 2028, 5),
    0
  );
  const afterInterrupt = readManagerCareerRaw(0);
  assert(!interrupted.ok, "interrupted candidate reports failure");
  assert(
    getManagerSaveSlotPointer(0)?.generationId === oldPointer?.generationId &&
      afterInterrupt?.seed === "round-trip-seed",
    "interrupted write leaves active career unchanged"
  );

  reset();
  writeManagerCareerRaw(career("Hull KR", "slot-zero"), 0);
  writeManagerCareerRaw(career("St Helens", "slot-two"), 2);
  assert(
    readManagerCareerRaw(0)?.seed === "slot-zero" &&
      readManagerCareerRaw(1) === null &&
      readManagerCareerRaw(2)?.seed === "slot-two",
    "multiple slots remain isolated"
  );

  const migrationStore = reset();
  const legacy = career("Wakefield Trinity", "legacy-seed", 2025, 9);
  local.setItem(STORAGE_KEYS.managerCareerSlot(1), JSON.stringify(legacy));
  await ensureManagerSaveStorageReady();
  const migratedPointer = getManagerSaveSlotPointer(1);
  assert(
    migratedPointer != null &&
      migrationStore.get(migratedPointer.generationId) != null,
    "legacy career migrates to a pointer and blob"
  );
  assert(
    local.getItem(STORAGE_KEYS.managerCareerSlot(1)) === null &&
      readManagerCareerRaw(1)?.seed === "legacy-seed",
    "legacy JSON is removed after successful migration"
  );

  const breakdown = measureCareerSaveSize(legacy);
  assert(
    breakdown.totalBytes > 0 &&
      Object.keys(breakdown.categories).length > 1 &&
      breakdown.categories.other > 0,
    "save diagnostics report total bytes and categories"
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void run();
