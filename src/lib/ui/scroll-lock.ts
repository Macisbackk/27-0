/**
 * Reference-counted document scroll lock.
 * One service for spins, calendar animation, modals, and popups.
 * Releasing one owner never clears another owner's lock.
 * Compensates scrollbar width so page width does not jump.
 */

export type ScrollLockId = string;

type LockRecord = {
  id: ScrollLockId;
  owner: string;
  acquiredAt: number;
};

type ScrollSnapshot = {
  bodyOverflow: string;
  htmlOverflow: string;
  bodyPaddingRight: string;
  htmlPaddingRight: string;
  scrollX: number;
  scrollY: number;
  scrollbarGap: number;
};

const locks = new Map<ScrollLockId, LockRecord>();
let snapshot: ScrollSnapshot | null = null;
let touchBlockerAttached = false;
let idSeq = 0;
/** Coalesce unlock→relock in the same React effect flush (Play Game → match review). */
let restoreScheduled = false;

function isBrowser(): boolean {
  return typeof document !== "undefined" && typeof window !== "undefined";
}

function measureScrollbarGap(): number {
  if (!isBrowser()) return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function blockTouchMove(event: TouchEvent): void {
  const target = event.target;
  if (target instanceof Element) {
    // Allow scroll inside marked regions (sidebar nav, modals with overflow).
    if (target.closest("[data-scroll-lock-allow='true']")) return;
    // Also allow any overflow-scrolling ancestor (defensive for nested panels).
    let node: Element | null = target;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      if (
        (oy === "auto" || oy === "scroll" || oy === "overlay") &&
        (node as HTMLElement).scrollHeight > (node as HTMLElement).clientHeight
      ) {
        return;
      }
      node = node.parentElement;
    }
  }
  event.preventDefault();
}

function attachTouchBlocker(): void {
  if (!isBrowser() || touchBlockerAttached) return;
  document.addEventListener("touchmove", blockTouchMove, { passive: false });
  touchBlockerAttached = true;
}

function detachTouchBlocker(): void {
  if (!isBrowser() || !touchBlockerAttached) return;
  document.removeEventListener("touchmove", blockTouchMove);
  touchBlockerAttached = false;
}

function applyLockStyles(): void {
  if (!isBrowser() || !snapshot) return;
  const gap = snapshot.scrollbarGap;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${snapshot.scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  if (gap > 0) {
    document.body.style.paddingRight = `${gap}px`;
    document.documentElement.style.paddingRight = `${gap}px`;
  }
  document.documentElement.dataset.uiOverlay = "1";
  attachTouchBlocker();
}

function restoreScrollStyles(): void {
  if (!isBrowser() || !snapshot) return;
  const {
    bodyOverflow,
    htmlOverflow,
    bodyPaddingRight,
    htmlPaddingRight,
    scrollX,
    scrollY,
  } = snapshot;
  document.body.style.overflow = bodyOverflow;
  document.documentElement.style.overflow = htmlOverflow;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.paddingRight = bodyPaddingRight;
  document.documentElement.style.paddingRight = htmlPaddingRight;
  delete document.documentElement.dataset.uiOverlay;
  detachTouchBlocker();
  // Restore after styles clear — double rAF avoids Safari clamping against sticky chrome.
  const x = scrollX;
  const y = scrollY;
  snapshot = null;
  requestAnimationFrame(() => {
    window.scrollTo(x, y);
    requestAnimationFrame(() => {
      window.scrollTo(x, y);
    });
  });
}

function scheduleRestoreIfIdle(): void {
  if (restoreScheduled) return;
  restoreScheduled = true;
  queueMicrotask(() => {
    restoreScheduled = false;
    if (locks.size === 0 && snapshot) {
      restoreScrollStyles();
    }
  });
}

/** Acquire a named scroll lock. Returns an id that must be released. */
export function acquireScrollLock(owner: string): ScrollLockId {
  if (!isBrowser()) return `ssr-${owner}-${++idSeq}`;

  const id: ScrollLockId = `${owner}-${Date.now()}-${++idSeq}`;
  if (locks.size === 0) {
    // Reuse snapshot when a prior lock deferred restore (modal handoff).
    if (!snapshot) {
      snapshot = {
        bodyOverflow: document.body.style.overflow,
        htmlOverflow: document.documentElement.style.overflow,
        bodyPaddingRight: document.body.style.paddingRight,
        htmlPaddingRight: document.documentElement.style.paddingRight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollbarGap: measureScrollbarGap(),
      };
      applyLockStyles();
    }
  }
  locks.set(id, { id, owner, acquiredAt: Date.now() });
  if (process.env.NODE_ENV === "development") {
    console.debug("[scroll-lock] acquire", owner, id, listActiveScrollLocks());
  }
  return id;
}

/** Release one lock by id. Scrolling restores only when no locks remain. */
export function releaseScrollLock(id: ScrollLockId | null | undefined): void {
  if (!id || !locks.has(id)) return;
  locks.delete(id);
  if (process.env.NODE_ENV === "development") {
    console.debug("[scroll-lock] release", id, listActiveScrollLocks());
  }
  if (locks.size === 0) {
    scheduleRestoreIfIdle();
  }
}

export function listActiveScrollLocks(): { id: string; owner: string }[] {
  return [...locks.values()].map(({ id, owner }) => ({ id, owner }));
}

export function hasActiveScrollLocks(): boolean {
  return locks.size > 0;
}

export function clearAbandonedAnimationScrollLocks(
  ownerPrefixes: string[] = ["quick-mode-spin", "calendar-sim"]
): void {
  for (const [id, record] of locks) {
    if (ownerPrefixes.some((p) => record.owner === p || id.startsWith(p))) {
      locks.delete(id);
    }
  }
  if (locks.size === 0) {
    scheduleRestoreIfIdle();
  }
}

/** Force-clear everything (tests / emergency). Prefer releaseScrollLock. */
export function resetScrollLockForTests(): void {
  locks.clear();
  if (snapshot) restoreScrollStyles();
  else if (isBrowser()) {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.paddingRight = "";
    document.documentElement.style.paddingRight = "";
    delete document.documentElement.dataset.uiOverlay;
    detachTouchBlocker();
  }
}
