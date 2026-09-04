"use client";

/**
 * Manager Mode tutorial overlay.
 *
 * Hit-testing (mandatory):
 * - Visual dim/spotlight are pointer-events: none — never in the hit stack.
 * - No full-screen / hole "blocker" panels over the app. Those sit in a body
 *   portal above Manager chrome and steal clicks when stacking contexts prevent
 *   nav elevation from winning (the Squad bug).
 * - While the tutorial is active, a document capture listener allows ONLY:
 *     1) the resolved real target (and its descendants)
 *     2) the tutorial callout (Next / copy)
 *   Every other pointer/click/touch is swallowed.
 * - The user must physically activate the real Manager Mode control.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GameButton } from "@/components/ui/GameButton";
import {
  advanceManagerTutorial,
  completeManagerTutorial,
  getActiveManagerTutorialStep,
  getManagerTutorialStepCount,
  getManagerTutorialStepIndex,
  isManagerTutorialDebugEnabled,
  isTutorialChromeElement,
  isTutorialCompactViewport,
  resolveStepTargetId,
  resolveTutorialTarget,
  stepExpectationMet,
  stepNeedsUserTap,
  tutorialNavLockForStep,
  type ManagerTutorialNavLock,
} from "@/lib/manager/managerTutorial";
import { isManagerMobileMoreNavView } from "@/lib/manager/manager-nav-config";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { uiLayerClass } from "@/lib/ui/layers";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface Props {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  currentView: ManagerView;
  moreMenuOpen: boolean;
  onMoreMenuOpenChange: (open: boolean) => void;
  onTutorialLockChange: (lock: ManagerTutorialNavLock) => void;
  clubOfficeTab?: "finances" | "boosts" | "facilities" | "settings" | null;
}

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const CALLOUT_GAP = 12;

function safeViewport(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const vv = window.visualViewport;
  const top = (vv?.offsetTop ?? 0) + 8;
  const left = (vv?.offsetLeft ?? 0) + 8;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;
  const bottomChrome = window.matchMedia("(max-width: 639px)").matches
    ? 88
    : 16;
  return {
    top,
    left,
    right: left + width - 16,
    bottom: top + height - bottomChrome - 8,
  };
}

function padRect(r: DOMRect): Rect {
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

function rectInSafeArea(
  r: Rect,
  safe: ReturnType<typeof safeViewport>
): boolean {
  return r.top >= safe.top - 2 && r.top + r.height <= safe.bottom + 2;
}

function minimalScrollIntoSafeArea(el: HTMLElement): void {
  const safe = safeViewport();
  const r = el.getBoundingClientRect();
  let delta = 0;
  if (r.top < safe.top) delta = r.top - safe.top - 12;
  else if (r.bottom > safe.bottom) delta = r.bottom - safe.bottom + 12;
  if (Math.abs(delta) < 4) return;
  window.scrollBy({ top: delta, left: 0, behavior: "auto" });
}

/**
 * Place callout so it never overlaps the tap target (callout is interactive).
 * Prefer opposite side of the viewport from the target.
 */
function placeCallout(
  target: Rect | null,
  preferAwayFromTarget: boolean
): { top: number; left: number; width: number } {
  const safe = safeViewport();
  const width = Math.min(340, safe.right - safe.left);
  const estHeight = 170;

  if (!target) {
    return {
      top: safe.top + Math.max(0, (safe.bottom - safe.top - estHeight) * 0.25),
      left: safe.left + (safe.right - safe.left - width) / 2,
      width,
    };
  }

  const targetMidY = target.top + target.height / 2;
  const viewportMid = (safe.top + safe.bottom) / 2;
  const targetInLowerHalf = targetMidY > viewportMid;

  let top: number;
  if (preferAwayFromTarget) {
    // Bottom/fixed nav targets → callout at top. Top chrome → callout lower.
    if (targetInLowerHalf) {
      top = safe.top;
    } else {
      top = Math.min(
        safe.bottom - estHeight,
        target.top + target.height + CALLOUT_GAP
      );
      if (top < target.top + target.height) {
        top = Math.min(safe.bottom - estHeight, viewportMid);
      }
    }
  } else {
    const below = target.top + target.height + CALLOUT_GAP;
    const above = target.top - CALLOUT_GAP - estHeight;
    if (below + estHeight <= safe.bottom) top = below;
    else if (above >= safe.top) top = above;
    else top = safe.top;
  }

  top = Math.max(safe.top, Math.min(top, safe.bottom - estHeight));
  let left = target.left + target.width / 2 - width / 2;
  left = Math.max(safe.left, Math.min(left, safe.right - width));

  // Final overlap guard — shove to the opposite end of the safe area.
  if (top < target.top + target.height - 1 && top + estHeight > target.top + 1) {
    top = targetInLowerHalf
      ? safe.top
      : Math.max(safe.top, safe.bottom - estHeight);
  }

  return { top, left, width };
}

function describeEl(el: Element | null): string {
  if (!(el instanceof HTMLElement)) return String(el);
  const id = el.getAttribute("data-tutorial-target");
  const tag = el.tagName.toLowerCase();
  const text = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);
  return id
    ? `${tag}[data-tutorial-target=${id}] "${text}"`
    : `${tag} "${text}"`;
}

function nodeAllowed(
  node: EventTarget | null,
  target: HTMLElement | null,
  callout: HTMLElement | null
): boolean {
  if (!(node instanceof Node)) return false;
  if (target && (target === node || target.contains(node))) return true;
  if (callout && (callout === node || callout.contains(node))) return true;
  return false;
}

export function ManagerTutorialOverlay({
  career,
  onUpdate,
  currentView,
  moreMenuOpen,
  onMoreMenuOpenChange,
  onTutorialLockChange,
  clubOfficeTab = null,
}: Props) {
  const step = getActiveManagerTutorialStep(career);
  const [compact, setCompact] = useState(isTutorialCompactViewport);
  const [debug] = useState(() => isManagerTutorialDebugEnabled());

  const ctx = useMemo(
    () => ({
      compact,
      moreOpen: moreMenuOpen,
      currentView,
      clubOfficeTab,
    }),
    [compact, moreMenuOpen, currentView, clubOfficeTab]
  );

  const targetId = useMemo(
    () => (step ? resolveStepTargetId(step, ctx) : null),
    [step, ctx]
  );
  const needsTap = Boolean(step && stepNeedsUserTap(step, ctx));
  const showNext = Boolean(step && step.action === "inspect");

  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [callout, setCallout] = useState(() => placeCallout(null, false));
  const [chrome, setChrome] = useState(false);
  const [found, setFound] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [hitTest, setHitTest] = useState<string>("—");

  const targetElRef = useRef<HTMLElement | null>(null);
  const targetIdRef = useRef(targetId);
  targetIdRef.current = targetId;
  const scrolledForKeyRef = useRef<string | null>(null);
  const advancedKeyRef = useRef<string | null>(null);
  const careerRef = useRef(career);
  careerRef.current = career;
  const panelRef = useRef<HTMLDivElement | null>(null);

  const runHitTest = useCallback(
    (el: HTMLElement | null, rect: Rect | null) => {
      if (!debug || !el || !rect) {
        setHitTest("—");
        return;
      }
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      const stack = document
        .elementsFromPoint(x, y)
        .slice(0, 8)
        .map(describeEl)
        .join(" → ");
      const pe = window.getComputedStyle(el).pointerEvents;
      const ok =
        top === el ||
        (top instanceof Node && el.contains(top)) ||
        (top instanceof HTMLElement &&
          top.closest(
            `[data-tutorial-target="${el.getAttribute("data-tutorial-target")}"]`
          ) === el);
      setHitTest(
        `${ok ? "OK" : "BLOCKED"} @(${Math.round(x)},${Math.round(y)}) top=${describeEl(top)} | pe=${pe} | ${stack}`
      );
      if (!ok) {
        // eslint-disable-next-line no-console
        console.error("[manager-tutorial] hit-test FAIL", {
          target: describeEl(el),
          top: describeEl(top),
          stack,
        });
      } else {
        // eslint-disable-next-line no-console
        console.info("[manager-tutorial] hit-test OK", {
          target: describeEl(el),
          top: describeEl(top),
        });
      }
    },
    [debug]
  );

  const measure = useCallback(
    (el: HTMLElement | null, asChrome: boolean) => {
      if (!el) {
        setSpotlight(null);
        setCallout(placeCallout(null, false));
        setChrome(false);
        runHitTest(null, null);
        return;
      }
      const rect = padRect(el.getBoundingClientRect());
      setSpotlight(rect);
      setChrome(asChrome);
      setCallout(placeCallout(rect, true));
      // Hit-test after layout paint so callout position is applied.
      requestAnimationFrame(() => runHitTest(el, rect));
    },
    [runHitTest]
  );

  const sync = useCallback(
    (opts?: { allowScroll?: boolean }) => {
      if (!step) return;
      const hit = resolveTutorialTarget(targetId);
      setMatchCount(hit.matchCount);
      setFound(Boolean(hit.el));
      targetElRef.current = hit.el;

      if (!hit.el) {
        measure(null, false);
        return;
      }

      const isChrome = isTutorialChromeElement(hit.el);
      const key = `${step.id}:${targetId}`;

      if (
        opts?.allowScroll &&
        scrolledForKeyRef.current !== key &&
        !isChrome
      ) {
        const safe = safeViewport();
        const r = padRect(hit.el.getBoundingClientRect());
        if (!rectInSafeArea(r, safe)) {
          minimalScrollIntoSafeArea(hit.el);
        }
        scrolledForKeyRef.current = key;
        requestAnimationFrame(() => {
          if (targetElRef.current === hit.el) measure(hit.el, isChrome);
        });
      }

      measure(hit.el, isChrome);
    },
    [step, targetId, measure]
  );

  // Compact breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Skip mobile-only steps on desktop.
  useEffect(() => {
    if (!step?.mobileOnly || compact) return;
    onUpdate(advanceManagerTutorial(careerRef.current));
  }, [step?.id, step?.mobileOnly, compact, onUpdate]);

  // Advance only when real app state matches.
  useEffect(() => {
    if (!step) return;
    if (step.action === "inspect") return;
    if (!stepExpectationMet(step, ctx)) {
      advancedKeyRef.current = null;
      return;
    }
    const key = `${step.id}:done`;
    if (advancedKeyRef.current === key) return;
    advancedKeyRef.current = key;

    const nextCareer = advanceManagerTutorial(careerRef.current);
    const nextStep = getActiveManagerTutorialStep(nextCareer);
    const nextNeedsMore =
      compact &&
      nextStep?.action === "click" &&
      nextStep.expected?.tab != null &&
      isManagerMobileMoreNavView(nextStep.expected.tab);
    if (!nextNeedsMore) onMoreMenuOpenChange(false);
    onUpdate(nextCareer);
  }, [step, ctx, compact, onUpdate, onMoreMenuOpenChange]);

  // Nav lock — disable sibling tabs; does not elevate for hit-testing.
  useEffect(() => {
    if (!step) {
      onTutorialLockChange(null);
      return;
    }
    onTutorialLockChange(tutorialNavLockForStep(step, ctx));
  }, [step, ctx, onTutorialLockChange]);

  useEffect(() => () => onTutorialLockChange(null), [onTutorialLockChange]);

  /**
   * Document capture lock — the actual click path fix.
   * Allows the real target (and callout) only. Does not invent clicks.
   * Does not preventDefault on generic touchstart (that kills scrolling).
   */
  useEffect(() => {
    if (!step) return;

    const resolveLiveTarget = (): HTMLElement | null => {
      const id = targetIdRef.current;
      if (!id) return targetElRef.current;
      const hit = resolveTutorialTarget(id);
      if (hit.el) targetElRef.current = hit.el;
      return hit.el ?? targetElRef.current;
    };

    const isAllowedEventTarget = (raw: EventTarget | null): boolean => {
      const live = resolveLiveTarget();
      if (nodeAllowed(raw, live, panelRef.current)) return true;
      const id = targetIdRef.current;
      if (id && raw instanceof Element) {
        const match = raw.closest(`[data-tutorial-target="${id}"]`);
        if (match instanceof HTMLElement) {
          targetElRef.current = match;
          return true;
        }
      }
      return false;
    };

    const blockActivation = (event: Event) => {
      if (isAllowedEventTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    /** Block starting a press on foreign controls — leave plain pan/scroll alone. */
    const blockForeignControlPointer = (event: Event) => {
      if (isAllowedEventTarget(event.target)) return;
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest(
        'button, a, input, select, textarea, [role="button"], [role="tab"], [data-tutorial-target]'
      );
      if (!control) return;
      if (isAllowedEventTarget(control)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const opts: AddEventListenerOptions = { capture: true };
    document.addEventListener("click", blockActivation, opts);
    document.addEventListener("pointerup", blockActivation, opts);
    document.addEventListener("mouseup", blockActivation, opts);
    document.addEventListener("pointerdown", blockForeignControlPointer, opts);
    document.addEventListener("mousedown", blockForeignControlPointer, opts);

    return () => {
      document.removeEventListener("click", blockActivation, opts);
      document.removeEventListener("pointerup", blockActivation, opts);
      document.removeEventListener("mouseup", blockActivation, opts);
      document.removeEventListener("pointerdown", blockForeignControlPointer, opts);
      document.removeEventListener("mousedown", blockForeignControlPointer, opts);
    };
  }, [step?.id, targetId]);

  useEffect(() => {
    scrolledForKeyRef.current = null;
    const t = window.setTimeout(() => sync({ allowScroll: true }), 40);
    return () => window.clearTimeout(t);
  }, [sync, step?.id, targetId, currentView, moreMenuOpen, clubOfficeTab]);

  useEffect(() => {
    let debounce: number | null = null;
    const remasure = () => {
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        sync({ allowScroll: false });
      }, 80);
    };
    window.addEventListener("resize", remasure);
    window.addEventListener("scroll", remasure, { passive: true });
    window.visualViewport?.addEventListener("resize", remasure);
    return () => {
      window.removeEventListener("resize", remasure);
      window.removeEventListener("scroll", remasure);
      window.visualViewport?.removeEventListener("resize", remasure);
      if (debounce != null) window.clearTimeout(debounce);
    };
  }, [sync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Re-run hit test when callout moves (debug).
  useEffect(() => {
    if (!debug || !targetElRef.current || !spotlight) return;
    const t = window.setTimeout(() => {
      runHitTest(targetElRef.current, spotlight);
    }, 50);
    return () => window.clearTimeout(t);
  }, [debug, callout, spotlight, runHitTest]);

  const goNext = useCallback(() => {
    playUiClick();
    if (!step) return;
    if (step.id === "finish") {
      onUpdate(completeManagerTutorial(career));
      return;
    }
    const nextCareer = advanceManagerTutorial(career);
    const nextStep = getActiveManagerTutorialStep(nextCareer);
    const nextNeedsMore =
      compact &&
      nextStep?.action === "click" &&
      nextStep.expected?.tab != null &&
      isManagerMobileMoreNavView(nextStep.expected.tab);
    if (!nextNeedsMore) onMoreMenuOpenChange(false);
    onUpdate(nextCareer);
  }, [career, onUpdate, step, compact, onMoreMenuOpenChange]);

  if (!step) return null;

  const waiting = needsTap && Boolean(targetId);
  const allowNext =
    showNext ||
    (step.action === "inspect" && !found && Boolean(step.targetId));
  const actionHint =
    targetId === "manager-more" && step.targetId !== "manager-more"
      ? "Tap ⋯ More in the bottom bar first."
      : targetId === "manager-more"
        ? "Tap ⋯ More in the bottom bar."
        : step.action === "click"
          ? "Tap the highlighted control."
          : null;

  const description =
    targetId === "manager-more" && step.targetId !== "manager-more"
      ? `${step.description} First open More — ${step.title.replace(/^Open /, "")} is inside that menu.`
      : step.description;

  return (
    <>
      {/* Visual only — never participates in hit-testing. */}
      <BodyPortal>
        <div
          className={`manager-tutorial-overlay pointer-events-none fixed inset-0 ${uiLayerClass("criticalAnimation")} overflow-hidden`}
          role="presentation"
          aria-hidden={false}
          aria-labelledby="manager-tutorial-title"
        >
          {spotlight ? (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-xl ring-2 ring-theme-primary/90"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.78)",
              }}
            />
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black/80"
            />
          )}

          {debug && spotlight && targetId ? (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded bg-black/85 px-1.5 py-0.5 font-mono text-[10px] text-lime-300"
              style={{
                top: Math.max(4, spotlight.top - 18),
                left: spotlight.left,
              }}
            >
              TARGET: {targetId}
            </div>
          ) : null}
        </div>
      </BodyPortal>

      <BodyPortal>
        <div className="manager-tutorial-callout-layer pointer-events-none fixed inset-0">
          <Callout
            title={
              targetId === "manager-more" && step.targetId !== "manager-more"
                ? "Open More"
                : step.title
            }
            description={description}
            actionHint={waiting ? actionHint : null}
            showNext={allowNext && !waiting}
            nextLabel={step.nextLabel ?? "Next"}
            stepIndex={getManagerTutorialStepIndex(step.id)}
            stepTotal={getManagerTutorialStepCount(compact)}
            box={callout}
            panelRef={panelRef}
            onNext={goNext}
          />
        </div>
      </BodyPortal>

      {debug ? (
        <BodyPortal>
          <div
            className="pointer-events-none fixed bottom-2 left-2 z-[10050] max-w-[min(100vw-1rem,24rem)] rounded border border-lime-500/50 bg-black/90 p-2 font-mono text-[10px] leading-snug text-lime-200"
            aria-hidden
          >
            <div className="font-bold text-lime-300">Tutorial debug</div>
            <div>Step: {step.id}</div>
            <div>Target: {targetId ?? "(none)"}</div>
            <div>
              Found: {found ? "YES" : "NO"} · Matches: {matchCount} · Chrome:{" "}
              {chrome ? "YES" : "NO"}
            </div>
            <div>
              Tab: {currentView} · More: {moreMenuOpen ? "OPEN" : "closed"}
              {clubOfficeTab ? ` · Club: ${clubOfficeTab}` : ""}
            </div>
            <div>
              Expected:{" "}
              {step.expected ? JSON.stringify(step.expected) : "—"}
            </div>
            <div className="mt-1 break-all text-amber-200">Hit: {hitTest}</div>
          </div>
        </BodyPortal>
      ) : null}
    </>
  );
}

function Callout({
  title,
  description,
  actionHint,
  showNext,
  nextLabel,
  stepIndex,
  stepTotal,
  box,
  panelRef,
  onNext,
}: {
  title: string;
  description: string;
  actionHint: string | null;
  showNext: boolean;
  nextLabel: string;
  stepIndex: number;
  stepTotal: number;
  box: { top: number; left: number; width: number };
  panelRef: RefObject<HTMLDivElement | null>;
  onNext: () => void;
}) {
  const style: CSSProperties = {
    top: box.top,
    left: box.left,
    width: box.width,
    maxHeight: "42vh",
  };
  return (
    <div
      ref={panelRef}
      className="pointer-events-auto absolute overflow-hidden outline-none"
      style={style}
    >
      <div className="rounded-xl border border-theme-primary/40 bg-pitch-950 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        <p className={`${TYPO.keyLabel} text-theme-primary`}>
          Step {stepIndex + 1} of {stepTotal}
        </p>
        <h2
          id="manager-tutorial-title"
          className="mt-1 text-[0.95rem] font-bold leading-snug text-white sm:text-base"
        >
          {title}
        </h2>
        <p className="mt-1 text-[0.8125rem] leading-snug text-pitch-300 sm:text-sm">
          {description}
        </p>
        {actionHint ? (
          <p className="mt-2 rounded-md border border-theme-primary/35 bg-theme-primary/10 px-2.5 py-1.5 text-[0.75rem] font-semibold leading-snug text-theme-primary">
            {actionHint}
          </p>
        ) : null}
        {showNext ? (
          <div className="mt-2.5">
            <GameButton
              variant="theme"
              size="sm"
              className="min-h-10 min-w-[5.5rem]"
              onClick={onNext}
            >
              {nextLabel}
            </GameButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
