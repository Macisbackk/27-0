/**
 * Probe Manager autosave persistence: serialize, meta recovery.
 * Run: npx tsx scripts/probe-manager-autosave.ts
 */

import { webcrypto } from "node:crypto";

const store = new Map<string, string>();

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
};
(globalThis as any).crypto = webcrypto;
(globalThis as any).indexedDB = {
  open() {
    const req: any = {
      result: null,
      error: new Error("IndexedDB unavailable in probe"),
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    queueMicrotask(() => req.onerror?.({}));
    return req;
  },
};

async function main() {
  const { initializeManagerDatabase } = await import("../src/lib/manager/database");
  const {
    saveManagerState,
    persistManagerProgress,
    loadManagerState,
    getSaveSlotMetadata,
    ensureSlotMetadata,
    recoverAllSaveMetadata,
    deleteSaveSlot,
  } = await import("../src/lib/manager/storage");

  await deleteSaveSlot("auto");

  const base = initializeManagerDatabase("widnes-vikings", "Probe Coach");

  const weekState = (week: number) => ({
    ...base,
    calendar: { ...base.calendar, currentWeek: week },
  });

  // 1) Rapid overlapping persists coalesce to latest week
  const p1 = persistManagerProgress(weekState(1));
  const p2 = persistManagerProgress(weekState(2));
  const p3 = persistManagerProgress(weekState(5));
  await Promise.all([p1, p2, p3]);
  await new Promise((r) => setTimeout(r, 80));
  await persistManagerProgress(weekState(5));

  const loaded = await loadManagerState("auto");
  const week = loaded?.calendar?.currentWeek;
  console.log("coalesce_week", week);
  if (week !== 5) throw new Error(`Expected week 5 after coalesce, got ${week}`);

  const meta = getSaveSlotMetadata("auto");
  console.log("meta_week", meta?.week);
  if (meta?.week !== 5) throw new Error("Meta not written");

  // 2) Wipe meta only — ensureSlotMetadata recovers from blob
  store.delete("27-0-manager-save-v3-autosave-meta");
  if (getSaveSlotMetadata("auto")) throw new Error("Meta should be gone");
  const recovered = await ensureSlotMetadata("auto");
  console.log("recovered_week", recovered?.week);
  if (recovered?.week !== 5) throw new Error("Meta recovery failed");

  // 3) recoverAllSaveMetadata lists autosave again
  store.delete("27-0-manager-save-v3-autosave-meta");
  const all = await recoverAllSaveMetadata();
  console.log(
    "recovered_slots",
    all.map((m) => `${m.slot}:w${m.week}`).join(",")
  );
  if (!all.some((m) => m.slot === "auto" && m.week === 5)) {
    throw new Error("recoverAllSaveMetadata missed autosave");
  }

  // 4) Direct save still works
  await saveManagerState(weekState(8), "auto", { skipCloud: true });
  const after = await loadManagerState("auto");
  console.log("after_direct_week", after?.calendar?.currentWeek);
  if (after?.calendar?.currentWeek !== 8) throw new Error("Direct save failed");

  console.log("PASS");
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
