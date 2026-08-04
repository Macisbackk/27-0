/**
 * Scroll-lock service smoke tests.
 * Run: npx tsx scripts/test-scroll-lock.ts
 *
 * Expected Match Review / page scroll behaviour:
 * - After Quick Mode recruitment spin completes, scroll unlocks so Match Review
 *   (and the rest of the document) scrolls normally again.
 * - After Calendar Sim-to-Date overlay dismisses, scroll unlocks the same way.
 * - Achievement / modal overlays use the "modal" owner; clearing abandoned
 *   animation locks must never wipe an open modal lock.
 * - Refresh while an animation lock was held should recover via
 *   clearAbandonedAnimationScrollLocks on DocumentPageShell mount.
 */

import {
  acquireScrollLock,
  clearAbandonedAnimationScrollLocks,
  hasActiveScrollLocks,
  listActiveScrollLocks,
  releaseScrollLock,
  resetScrollLockForTests,
} from "../src/lib/ui/scroll-lock";

function installDomStub(): void {
  const bodyStyle: Record<string, string> = {};
  const htmlStyle: Record<string, string> = {};
  // Minimal browser surface for apply/restore in scroll-lock.ts
  (globalThis as { window?: unknown }).window = {
    scrollX: 0,
    scrollY: 120,
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
  };
  (globalThis as { document?: unknown }).document = {
    body: { style: bodyStyle },
    documentElement: { style: htmlStyle },
    addEventListener() {},
    removeEventListener() {},
  };
}

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

installDomStub();
resetScrollLockForTests();

console.log("Scroll lock reference counting\n");

const first = acquireScrollLock("quick-mode-spin");
const second = acquireScrollLock("calendar-sim");
assert(hasActiveScrollLocks(), "two locks keep scroll locked");
assert(listActiveScrollLocks().length === 2, "lists both active locks");
assert(
  (globalThis as { document: { body: { style: { overflow: string } } } })
    .document.body.style.overflow === "hidden",
  "body overflow is hidden while locked"
);

releaseScrollLock(first);
assert(hasActiveScrollLocks(), "releasing one lock keeps scroll locked");
assert(
  listActiveScrollLocks().length === 1 &&
    listActiveScrollLocks()[0]?.owner === "calendar-sim",
  "remaining lock is calendar-sim"
);
assert(
  (globalThis as { document: { body: { style: { overflow: string } } } })
    .document.body.style.overflow === "hidden",
  "body still overflow-hidden after partial release"
);

releaseScrollLock(second);
assert(!hasActiveScrollLocks(), "releasing last lock unlocks scroll");
assert(listActiveScrollLocks().length === 0, "no active locks remain");

console.log("\nAbandoned animation clear preserves modal\n");

const modal = acquireScrollLock("modal");
const spin = acquireScrollLock("quick-mode-spin");
const cal = acquireScrollLock("calendar-sim");
clearAbandonedAnimationScrollLocks();
assert(
  listActiveScrollLocks().length === 1 &&
    listActiveScrollLocks()[0]?.owner === "modal",
  "clearAbandonedAnimationScrollLocks leaves modal owner"
);
assert(hasActiveScrollLocks(), "modal lock still holds scroll");
releaseScrollLock(modal);
assert(!hasActiveScrollLocks(), "releasing modal unlocks");
// stale ids must be harmless
releaseScrollLock(spin);
releaseScrollLock(cal);

resetScrollLockForTests();

console.log(
  failed === 0
    ? `\nALL PASS (${passed})`
    : `\nSOME FAILED (${failed} failed, ${passed} passed)`
);
process.exit(failed === 0 ? 0 : 1);
