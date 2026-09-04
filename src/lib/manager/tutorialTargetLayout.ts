/**
 * Mobile-first Manager Mode tutorial target positioning.
 * One layout engine for usable viewport, safe chrome, scroll-into-band, and callout placement.
 */

import { getDocumentScrollY, scrollDocumentTo } from "@/lib/ui/scroll";

export type LayoutRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

export type UsableViewport = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  vw: number;
  vh: number;
  isCompact: boolean;
};

export type CalloutPlacement =
  | "above"
  | "below"
  | "dock-top"
  | "dock-bottom";

export type CalloutBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: CalloutPlacement;
};

const COMPACT_MQ = 640;
const SPOTLIGHT_PAD_COMPACT = 6;
const SPOTLIGHT_PAD_DESKTOP = 8;
const CALLOUT_GAP = 10;
const CALLOUT_RESERVE = 148;

function rectFromDOMRect(r: DOMRect | LayoutRect): LayoutRect {
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    bottom: r.bottom,
    right: r.right,
  };
}

/** Cached safe-area insets — probe DOM once, reuse until viewport changes. */
let _cachedInsets: { top: number; right: number; bottom: number; left: number } | null = null;
let _insetsVw = 0;
let _insetsVh = 0;

function measureSafeInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (_cachedInsets && _insetsVw === vw && _insetsVh === vh) return _cachedInsets;
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;inset:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) " +
    "env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.documentElement.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  _cachedInsets = insets;
  _insetsVw = vw;
  _insetsVh = vh;
  return insets;
}

/** Invalidate cached insets on viewport change. */
export function invalidateSafeInsetCache(): void {
  _cachedInsets = null;
}

function resolveCssLength(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${raw}`;
  document.documentElement.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

function readRootCssPx(varName: string): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return resolveCssLength(raw);
}

/** True when the element (or an ancestor) is fixed to the viewport. */
export function isViewportFixedTarget(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement) {
    const pos = getComputedStyle(node).position;
    if (pos === "fixed") return true;
    node = node.parentElement;
  }
  return false;
}

export function measureUsableViewport(options?: {
  /** When true, also reserve the hub sticky play bar above the bottom nav. */
  reserveStickyPlaybar?: boolean;
  /**
   * When highlighting bottom-nav / More-sheet controls, keep them inside the
   * usable band so callouts can sit above them instead of clamping them away.
   */
  includeBottomChrome?: boolean;
}): UsableViewport {
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const isCompact = vw < COMPACT_MQ;
  const safe = measureSafeInsets();
  const pad = isCompact ? 8 : 12;

  const header = document.querySelector<HTMLElement>(".app-header");
  const headerBottom = header
    ? header.getBoundingClientRect().bottom
    : offsetTop + safe.top;

  let chromeBottom = offsetTop + vh - safe.bottom;

  if (!options?.includeBottomChrome) {
    const nav = document.querySelector<HTMLElement>("[data-manager-mobile-nav]");
    if (isCompact && nav) {
      const nr = nav.getBoundingClientRect();
      if (nr.height > 1) chromeBottom = Math.min(chromeBottom, nr.top);
    } else if (isCompact) {
      chromeBottom = Math.min(
        chromeBottom,
        offsetTop + vh - readRootCssPx("--manager-mobile-nav-h")
      );
    }

    if (options?.reserveStickyPlaybar && isCompact) {
      const playbar = document.querySelector<HTMLElement>(
        ".mobile-action-bar--above-nav:not(.invisible)"
      );
      if (playbar) {
        const pr = playbar.getBoundingClientRect();
        if (pr.height > 1 && getComputedStyle(playbar).visibility !== "hidden") {
          chromeBottom = Math.min(chromeBottom, pr.top);
        }
      } else {
        const playbarH = readRootCssPx("--manager-mobile-playbar-h");
        if (playbarH > 0) chromeBottom -= playbarH;
      }
    }
  }

  const top = Math.max(offsetTop + safe.top, headerBottom) + pad;
  const bottom = Math.max(top + 80, chromeBottom - pad);
  const left = offsetLeft + safe.left + pad;
  const right = Math.max(left + 120, offsetLeft + vw - safe.right - pad);

  return {
    top,
    left,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    vw,
    vh,
    isCompact,
  };
}

function scrollOverflowAncestors(el: HTMLElement, deltaY: number): void {
  if (Math.abs(deltaY) < 1) return;
  let node: HTMLElement | null = el.parentElement;
  let remaining = deltaY;
  while (node && node !== document.documentElement && Math.abs(remaining) >= 1) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    const canScroll =
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScroll) {
      const before = node.scrollTop;
      const max = node.scrollHeight - node.clientHeight;
      const next = Math.max(0, Math.min(max, before + remaining));
      node.scrollTop = next;
      remaining -= next - before;
    }
    node = node.parentElement;
  }
}

/**
 * Move the page just enough so `el` sits in the usable band (with callout reserve).
 * Caller must temporarily release scroll-lock around this call.
 */
export function scrollTargetIntoUsableRegion(
  el: HTMLElement,
  usable: UsableViewport
): boolean {
  if (isViewportFixedTarget(el)) return false;

  const rect = el.getBoundingClientRect();
  const margin = usable.isCompact ? 10 : 14;
  const shortViewport = usable.height < 420;
  const reserve = Math.min(
    CALLOUT_RESERVE,
    Math.max(shortViewport ? 72 : 96, usable.height * (shortViewport ? 0.24 : 0.32))
  );

  const spaceAbove = rect.top - usable.top;
  const spaceBelow = usable.bottom - rect.bottom;

  let bandTop = usable.top + margin;
  let bandBottom = usable.bottom - margin;

  if (rect.height + reserve + margin * 2 <= usable.height) {
    if (spaceBelow >= spaceAbove) {
      bandBottom = usable.bottom - reserve;
    } else {
      bandTop = usable.top + reserve;
    }
  }

  let delta = 0;
  if (rect.height > bandBottom - bandTop) {
    delta = rect.top - (usable.top + margin);
  } else if (rect.top < bandTop) {
    delta = rect.top - bandTop;
  } else if (rect.bottom > bandBottom) {
    delta = rect.bottom - bandBottom;
  }

  if (Math.abs(delta) < 2) return false;

  scrollDocumentTo(getDocumentScrollY() + delta);
  scrollOverflowAncestors(el, delta);
  return true;
}

export function spotlightRectForTarget(
  target: LayoutRect,
  usable: UsableViewport
): LayoutRect {
  const pad = usable.isCompact ? SPOTLIGHT_PAD_COMPACT : SPOTLIGHT_PAD_DESKTOP;
  let top = target.top - pad;
  let left = target.left - pad;
  let width = target.width + pad * 2;
  let height = target.height + pad * 2;

  // Huge targets (full hub): keep a readable spotlight within the usable band.
  const maxH = Math.max(120, usable.height * (usable.isCompact ? 0.42 : 0.55));
  if (height > maxH) {
    height = maxH;
  }

  // Keep spotlight inside the visual viewport (not under chrome).
  if (top < usable.top) {
    const shrink = usable.top - top;
    top = usable.top;
    height = Math.max(48, height - shrink);
  }
  if (top + height > usable.bottom) {
    height = Math.max(48, usable.bottom - top);
  }
  if (left < usable.left) {
    const shrink = usable.left - left;
    left = usable.left;
    width = Math.max(48, width - shrink);
  }
  if (left + width > usable.right) {
    width = Math.max(48, usable.right - left);
  }

  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
  };
}

export function placeTutorialCallout(
  target: LayoutRect,
  usable: UsableViewport,
  callout: { width: number; height: number },
  preferredPlacement?: CalloutPlacement | null
): CalloutBox {
  const width = Math.min(callout.width, usable.width);
  const shortViewport = usable.height < 420;
  const height = Math.min(
    callout.height,
    usable.height * (shortViewport ? 0.42 : 0.9)
  );
  const maxHeight = Math.max(96, usable.height * (shortViewport ? 0.45 : 0.92));

  const spaceAbove = Math.max(0, target.top - usable.top);
  const spaceBelow = Math.max(0, usable.bottom - target.bottom);
  const fitsBelow = spaceBelow >= height + CALLOUT_GAP;
  const fitsAbove = spaceAbove >= height + CALLOUT_GAP;
  const targetDominates = target.height > usable.height * 0.55;

  // Hysteresis: keep the previous side when both still fit, so tiny scroll
  // drift doesn't flip the callout every frame.
  const preferAbove =
    preferredPlacement === "above" || preferredPlacement === "dock-top";
  const preferBelow =
    preferredPlacement === "below" || preferredPlacement === "dock-bottom";

  let placement: CalloutPlacement;
  let top: number;

  if (targetDominates) {
    if (preferAbove && fitsAbove) {
      placement = "dock-top";
      top = usable.top;
    } else if (preferBelow && fitsBelow) {
      placement = "dock-bottom";
      top = usable.bottom - height;
    } else if (spaceBelow >= spaceAbove) {
      placement = "dock-bottom";
      top = usable.bottom - height;
    } else {
      placement = "dock-top";
      top = usable.top;
    }
  } else if (preferBelow && fitsBelow) {
    placement = "below";
    top = target.bottom + CALLOUT_GAP;
    if (top + height > usable.bottom) top = usable.bottom - height;
  } else if (preferAbove && fitsAbove) {
    placement = "above";
    top = target.top - CALLOUT_GAP - height;
    if (top < usable.top) top = usable.top;
  } else if (fitsBelow && (!fitsAbove || spaceBelow >= spaceAbove)) {
    placement = "below";
    top = target.bottom + CALLOUT_GAP;
    if (top + height > usable.bottom) top = usable.bottom - height;
  } else if (fitsAbove) {
    placement = "above";
    top = target.top - CALLOUT_GAP - height;
    if (top < usable.top) top = usable.top;
  } else if (spaceBelow >= spaceAbove) {
    placement = "dock-bottom";
    top = usable.bottom - height;
  } else {
    placement = "dock-top";
    top = usable.top;
  }

  // Never cover the target — nudge to the opposite side if we still overlap.
  const overlaps =
    top < target.bottom - 1 && top + height > target.top + 1;
  if (overlaps) {
    if (spaceBelow >= height + CALLOUT_GAP) {
      placement = "below";
      top = target.bottom + CALLOUT_GAP;
    } else if (spaceAbove >= height + CALLOUT_GAP) {
      placement = "above";
      top = target.top - CALLOUT_GAP - height;
    } else if (spaceBelow >= spaceAbove) {
      placement = "dock-bottom";
      top = Math.max(target.bottom + 4, usable.bottom - height);
      if (top < target.bottom) top = usable.bottom - height;
    } else {
      placement = "dock-top";
      top = Math.min(target.top - height - 4, usable.top);
      if (top + height > target.top) top = usable.top;
    }
  }

  top = Math.max(usable.top, Math.min(top, usable.bottom - height));

  let left = target.left + target.width / 2 - width / 2;
  left = Math.max(usable.left, Math.min(left, usable.right - width));

  return { top, left, width, maxHeight, placement };
}

export function layoutRectFromElement(el: HTMLElement): LayoutRect {
  return rectFromDOMRect(el.getBoundingClientRect());
}

type ElevateSnapshot = {
  position: string;
  top: string;
  left: string;
  width: string;
  height: string;
  zIndex: string;
  margin: string;
  boxShadow: string;
  placeholder: HTMLElement | null;
};

/**
 * Lift a tutorial target above the dim layer (z 10001) and under the callout
 * (z 10003). Chrome already elevated via `.manager-tutorial-nav-elevated` only
 * gets a local stack bump — never rip fixed-nav / sticky-bar controls out of flow.
 */
export function elevateTutorialTarget(el: HTMLElement): () => void {
  // Guard: already elevated by a prior effect that hasn't cleaned up yet.
  // Return a no-op — the prior cleanup will restore the element correctly.
  // This handles React Strict Mode double-fire and effect overlap.
  if (el.dataset.tutorialElevated === "1") {
    return () => undefined;
  }

  const rect = el.getBoundingClientRect();
  const computed = getComputedStyle(el);
  const alreadyFixed = computed.position === "fixed";
  const chromeAlreadyElevated = Boolean(
    el.closest(".manager-tutorial-nav-elevated")
  );
  const inFixedChrome = isViewportFixedTarget(el);
  const snapshot: ElevateSnapshot = {
    position: el.style.position,
    top: el.style.top,
    left: el.style.left,
    width: el.style.width,
    height: el.style.height,
    zIndex: el.style.zIndex,
    margin: el.style.margin,
    boxShadow: el.style.boxShadow,
    placeholder: null,
  };

  // Nav / More / sticky playbar: parent is already above the dim. Keep in-flow.
  if (chromeAlreadyElevated || (inFixedChrome && !alreadyFixed)) {
    if (computed.position === "static") {
      el.style.position = "relative";
    }
    el.style.zIndex = "2";
    el.style.boxShadow =
      "0 0 0 2px var(--theme-primary), 0 8px 24px rgba(0,0,0,0.45)";
    el.dataset.tutorialElevated = "1";
    return () => {
      el.style.position = snapshot.position;
      el.style.zIndex = snapshot.zIndex;
      el.style.boxShadow = snapshot.boxShadow;
      delete el.dataset.tutorialElevated;
    };
  }

  if (!alreadyFixed && el.parentElement) {
    const placeholder = document.createElement("div");
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.dataset.tutorialPlaceholder = "1";
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.flex = "none";
    placeholder.style.pointerEvents = "none";
    el.parentElement.insertBefore(placeholder, el);
    snapshot.placeholder = placeholder;

    el.style.position = "fixed";
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.margin = "0";
  }

  el.style.zIndex = "10002";
  el.style.boxShadow =
    "0 0 0 2px var(--theme-primary), 0 8px 24px rgba(0,0,0,0.45)";
  el.dataset.tutorialElevated = "1";

  return () => {
    if (snapshot.placeholder?.isConnected) {
      snapshot.placeholder.remove();
    }
    el.style.position = snapshot.position;
    el.style.top = snapshot.top;
    el.style.left = snapshot.left;
    el.style.width = snapshot.width;
    el.style.height = snapshot.height;
    el.style.zIndex = snapshot.zIndex;
    el.style.margin = snapshot.margin;
    el.style.boxShadow = snapshot.boxShadow;
    delete el.dataset.tutorialElevated;
  };
}

/** Four blocker panels around a hole (viewport coords). */
export function holeBlockerPanels(
  hole: LayoutRect | null,
  vw: number,
  vh: number
): LayoutRect[] {
  if (!hole) {
    return [{ top: 0, left: 0, width: vw, height: vh, bottom: vh, right: vw }];
  }
  const top = Math.max(0, hole.top);
  const left = Math.max(0, hole.left);
  const right = Math.min(vw, hole.right);
  const bottom = Math.min(vh, hole.bottom);
  const panels: LayoutRect[] = [];

  if (top > 0) {
    panels.push({
      top: 0,
      left: 0,
      width: vw,
      height: top,
      bottom: top,
      right: vw,
    });
  }
  if (bottom < vh) {
    panels.push({
      top: bottom,
      left: 0,
      width: vw,
      height: vh - bottom,
      bottom: vh,
      right: vw,
    });
  }
  if (bottom > top) {
    if (left > 0) {
      panels.push({
        top,
        left: 0,
        width: left,
        height: bottom - top,
        bottom,
        right: left,
      });
    }
    if (right < vw) {
      panels.push({
        top,
        left: right,
        width: vw - right,
        height: bottom - top,
        bottom,
        right: vw,
      });
    }
  }
  return panels;
}

/**
 * Compare two LayoutRects — returns true when they differ by more than `threshold` px.
 * Used to prevent re-renders from sub-pixel drift.
 */
export function rectMateriallyChanged(
  a: LayoutRect | null,
  b: LayoutRect | null,
  threshold = 1.5
): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  return (
    Math.abs(a.top - b.top) > threshold ||
    Math.abs(a.left - b.left) > threshold ||
    Math.abs(a.width - b.width) > threshold ||
    Math.abs(a.height - b.height) > threshold
  );
}

export function calloutMateriallyChanged(
  a: CalloutBox | null,
  b: CalloutBox | null,
  threshold = 1.5
): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  return (
    Math.abs(a.top - b.top) > threshold ||
    Math.abs(a.left - b.left) > threshold ||
    Math.abs(a.width - b.width) > threshold ||
    a.placement !== b.placement
  );
}

export function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
