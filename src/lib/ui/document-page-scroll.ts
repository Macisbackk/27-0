/**
 * Document-level scrolling helpers for ordinary (non-modal) pages.
 * Quick Mode reviews and similar surfaces must scroll with the browser
 * document — never via a nested fixed overflow container.
 */

import {
  clearAbandonedAnimationScrollLocks,
  hasActiveScrollLocks,
} from "@/lib/ui/scroll-lock";

export function isModalBodyLockActive(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('[aria-modal="true"]'));
}

/**
 * Clear temporary body/html overflow locks left by abandoned animations,
 * but never while a scroll-lock service lock or real aria-modal is active.
 */
export function clearStaleBodyScrollLocks(): void {
  if (typeof document === "undefined") return;

  // Drop spin / calendar locks left behind by refresh or interrupted overlays.
  clearAbandonedAnimationScrollLocks();

  if (hasActiveScrollLocks()) return;
  if (isModalBodyLockActive()) return;

  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
}

export type ScrollAncestorSnapshot = {
  tag: string;
  id: string;
  className: string;
  height: string;
  maxHeight: string;
  overflow: string;
  overflowY: string;
  position: string;
};

/** Dev-only: walk ancestors of a review root to find nested scroll owners. */
export function collectScrollAncestorSnapshots(
  root: HTMLElement | null
): ScrollAncestorSnapshot[] {
  if (!root || typeof window === "undefined") return [];
  const out: ScrollAncestorSnapshot[] = [];
  let el: HTMLElement | null = root;
  while (el) {
    const style = window.getComputedStyle(el);
    out.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      className: typeof el.className === "string" ? el.className.slice(0, 120) : "",
      height: style.height,
      maxHeight: style.maxHeight,
      overflow: style.overflow,
      overflowY: style.overflowY,
      position: style.position,
    });
    el = el.parentElement;
  }
  return out;
}

export function logDocumentScrollDiagnostics(
  label: string,
  root: HTMLElement | null
): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;
  let enabled = false;
  try {
    enabled = window.localStorage.getItem("27-0-debug-page-scroll") === "1";
  } catch {
    enabled = false;
  }
  if (!enabled) return;

  const ancestors = collectScrollAncestorSnapshots(root);
  const nestedOwners = ancestors.filter(
    (a) =>
      (a.overflowY === "auto" || a.overflowY === "scroll") &&
      a.tag !== "html" &&
      a.tag !== "body"
  );

  console.info(`[document-scroll] ${label}`, {
    route: window.location.pathname + window.location.search,
    bodyOverflow: document.body.style.overflow || "(css)",
    htmlOverflow: document.documentElement.style.overflow || "(css)",
    modalLockActive: isModalBodyLockActive(),
    nestedVerticalOwners: nestedOwners,
    ancestors,
  });
}
