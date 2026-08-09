/** Shared document / element scroll helpers — prefer these over ad-hoc jumps. */

export function getDocumentScrollRoot(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getDocumentScrollRoot requires a browser document");
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

export function getDocumentScrollY(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY || getDocumentScrollRoot().scrollTop || 0;
}

/** Clamp Y to the current document scroll range (after layout has settled). */
export function clampDocumentScrollY(y: number): number {
  if (typeof window === "undefined") return 0;
  const root = getDocumentScrollRoot();
  const max = Math.max(0, root.scrollHeight - root.clientHeight);
  return Math.max(0, Math.min(y, max));
}

/** Instant document scroll — no smooth animation (smooth causes visible thrash). */
export function scrollDocumentTo(y: number, x = 0): void {
  if (typeof window === "undefined") return;
  const root = getDocumentScrollRoot();
  const top = clampDocumentScrollY(y);
  const left = Math.max(0, x);
  if (root.scrollTop !== top) root.scrollTop = top;
  if (root.scrollLeft !== left) root.scrollLeft = left;
  if (window.scrollY !== top || window.scrollX !== left) {
    window.scrollTo(left, top);
  }
}

export function scrollDocumentToTop(): void {
  scrollDocumentTo(0, 0);
}

/**
 * Scroll an element into view without yanking to page center.
 * Prefer `nearest` for in-page selections; `start` for dedicated targets
 * that already use scroll-margin.
 */
export function scrollElementIntoView(
  el: HTMLElement | null | undefined,
  options?: {
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    behavior?: ScrollBehavior;
  }
): void {
  if (!el) return;
  el.scrollIntoView({
    behavior: options?.behavior ?? "auto",
    block: options?.block ?? "nearest",
    inline: options?.inline ?? "nearest",
  });
}
