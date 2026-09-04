"use client";

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
  isTutorialCompactViewport,
  resolveTutorialInteractionPhase,
  resolveTutorialPhaseTargets,
  tutorialCanRequireAdvanceWeek,
  tutorialLockTargetForPhase,
  tutorialPhaseNeedsTap,
  waitForTutorialTarget,
  type ManagerTutorialStepDef,
} from "@/lib/manager/managerTutorial";
import {
  calloutMateriallyChanged,
  holeBlockerPanels,
  invalidateSafeInsetCache,
  isViewportFixedTarget,
  layoutRectFromElement,
  measureUsableViewport,
  placeTutorialCallout,
  elevateTutorialTarget,
  rectMateriallyChanged,
  scrollTargetIntoUsableRegion,
  spotlightRectForTarget,
  waitFrames,
  type CalloutBox,
  type LayoutRect,
} from "@/lib/manager/tutorialTargetLayout";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { acquireScrollLock, releaseScrollLock } from "@/lib/ui/scroll-lock";
import { uiLayerClass } from "@/lib/ui/layers";
import { focusWithoutScroll } from "@/lib/ui/focus";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";
import type { ManagerMoreTutorialLock } from "@/components/manager/ManagerMobileBottomNav";

interface ManagerTutorialOverlayProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  onNavigate: (view: ManagerView) => void;
  currentView: ManagerView;
  moreMenuOpen: boolean;
  onMoreMenuOpenChange: (open: boolean) => void;
  onTutorialLockChange: (lock: ManagerMoreTutorialLock) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type LayoutState = {
  spotlight: LayoutRect | null;
  callout: CalloutBox | null;
  actionHole: LayoutRect | null;
  ready: boolean;
};

const EMPTY_LAYOUT: LayoutState = {
  spotlight: null,
  callout: null,
  actionHole: null,
  ready: false,
};

export function ManagerTutorialOverlay({
  career,
  onUpdate,
  onNavigate,
  currentView,
  moreMenuOpen,
  onMoreMenuOpenChange,
  onTutorialLockChange,
}: ManagerTutorialOverlayProps) {
  const step = getActiveManagerTutorialStep(career);
  const [compact, setCompact] = useState(isTutorialCompactViewport);

  // ── Phase & derived values ──────────────────────────────────────────────────
  const phase = useMemo(() => {
    if (!step) return "next" as const;
    if (
      step.action === "advance-week" &&
      !tutorialCanRequireAdvanceWeek(career)
    ) {
      return "next" as const;
    }
    return resolveTutorialInteractionPhase(step, {
      compact,
      moreOpen: moreMenuOpen,
      currentView,
    });
  }, [step, compact, moreMenuOpen, currentView, career]);

  const phaseTargets = useMemo(
    () => (step ? resolveTutorialPhaseTargets(step, phase) : undefined),
    [step, phase]
  );

  // Stable string key for phaseTargets so ResizeObserver effect doesn't re-create
  // on every render when the targets array is referentially new but content-equal.
  const phaseTargetsKey = phaseTargets?.join(",") ?? "";

  const needsTap = Boolean(step && tutorialPhaseNeedsTap(phase));
  const showNext =
    Boolean(step) &&
    (phase === "next" ||
      phase === "content" ||
      (step?.action === "advance-week" &&
        !tutorialCanRequireAdvanceWeek(career)));

  // ── Refs ────────────────────────────────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef<ReturnType<typeof acquireScrollLock> | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const layoutGenRef = useRef(0);
  const advancedMoreRef = useRef<string | null>(null);
  const careerRef = useRef(career);
  careerRef.current = career;
  /** Cleanup for the currently elevated target — owned by syncTargetLayout. */
  const unelevateRef = useRef<(() => void) | null>(null);
  const elevationSignalRef = useRef(0);
  /** Lets the ResizeObserver re-attach after a new target is resolved. */
  const [targetEpoch, setTargetEpoch] = useState(0);

  /** Ref holding the last committed layout — avoids setState for sub-pixel drift. */
  const layoutRef = useRef<LayoutState>(EMPTY_LAYOUT);

  /** Ref-stable versions of frequently changing props used by stable callbacks. */
  const needsTapRef = useRef(needsTap);
  needsTapRef.current = needsTap;
  const phaseTargetsRef = useRef(phaseTargets);
  phaseTargetsRef.current = phaseTargets;

  // ── State ───────────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<LayoutState>(EMPTY_LAYOUT);
  const [targetMissing, setTargetMissing] = useState(false);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  const clearElevation = useCallback(() => {
    if (unelevateRef.current) {
      unelevateRef.current();
      unelevateRef.current = null;
    }
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const withProgrammaticScroll = useCallback((fn: () => void) => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "";
    body.style.overflow = "";
    try {
      fn();
    } finally {
      html.style.overflow = prevHtml || "hidden";
      body.style.overflow = prevBody || "hidden";
    }
  }, []);

  /**
   * computeLayout: measure and commit geometry.
   * Uses layoutRef to skip setState when nothing has materially changed,
   * breaking the measure→setState→render→measure loop.
   *
   * IMPORTANT: does NOT set `ready: false` — callers do that via syncTargetLayout.
   * This function only transitions to `ready: true` when it has real geometry.
   */
  const computeLayout = useCallback(
    (el: HTMLElement | null, actionRequired: boolean) => {
      const vv = window.visualViewport;
      const viewW = vv?.width ?? window.innerWidth;
      const viewH = vv?.height ?? window.innerHeight;

      if (!el) {
        const usable = measureUsableViewport();
        const width = Math.min(usable.width, usable.isCompact ? 340 : 360);
        const height = Math.min(
          panelRef.current?.offsetHeight || 180,
          usable.height
        );
        const next: LayoutState = {
          spotlight: null,
          callout: {
            top: usable.top + Math.max(0, (usable.height - height) * 0.28),
            left: usable.left + (usable.width - width) / 2,
            width,
            maxHeight: usable.height,
            placement: "dock-top",
          },
          actionHole: null,
          ready: true,
        };

        // Only commit if this is genuinely different from current
        const prev = layoutRef.current;
        if (
          prev.ready &&
          !prev.spotlight &&
          !calloutMateriallyChanged(prev.callout, next.callout) &&
          Boolean(prev.actionHole) === actionRequired
        ) {
          return;
        }

        layoutRef.current = next;
        setVw(viewW);
        setVh(viewH);
        setLayout(next);
        return;
      }

      const inMoreSheet = Boolean(el.closest("[data-manager-more-sheet]"));
      const inMobileNav = Boolean(el.closest("[data-manager-mobile-nav]"));
      const reservePlaybar =
        !isViewportFixedTarget(el) &&
        !el.closest(".mobile-action-bar") &&
        !inMoreSheet &&
        !inMobileNav;
      const usable = measureUsableViewport({
        reserveStickyPlaybar: reservePlaybar,
        includeBottomChrome: inMoreSheet || inMobileNav,
      });
      const target = layoutRectFromElement(el);
      const spotlight = spotlightRectForTarget(target, usable);
      const measuredH =
        panelRef.current?.offsetHeight || (usable.isCompact ? 150 : 180);
      const measuredW = Math.min(usable.width, usable.isCompact ? 340 : 360);
      const callout = placeTutorialCallout(
        target,
        usable,
        {
          width: measuredW,
          height: measuredH,
        },
        layoutRef.current.ready ? layoutRef.current.callout?.placement : null
      );

      const prev = layoutRef.current;
      // Skip state update when geometry hasn't materially changed — stops feedback loop.
      if (
        prev.ready &&
        !rectMateriallyChanged(prev.spotlight, spotlight) &&
        !calloutMateriallyChanged(prev.callout, callout) &&
        Boolean(prev.actionHole) === actionRequired
      ) {
        return;
      }

      const next: LayoutState = {
        spotlight,
        callout,
        actionHole: actionRequired ? spotlight : null,
        ready: true,
      };
      layoutRef.current = next;
      setVw(viewW);
      setVh(viewH);
      setLayout(next);
    },
    [] // No deps — reads from refs, stable forever
  );

  /**
   * syncTargetLayout: authoritative layout sync.
   * Resets layout to not-ready, waits for the target to appear,
   * optionally scrolls it into view, then calls computeLayout once.
   *
   * The generation counter (layoutGenRef) ensures only the latest invocation
   * commits — stale async chains abort.
   */
  const syncTargetLayout = useCallback(
    async (opts?: { scroll?: boolean }) => {
      if (!step) {
        clearElevation();
        layoutRef.current = EMPTY_LAYOUT;
        setLayout(EMPTY_LAYOUT);
        targetElRef.current = null;
        return;
      }

      const gen = ++layoutGenRef.current;
      // Drop stale elevation/target immediately so we never highlight the previous step.
      clearElevation();
      targetElRef.current = null;
      setTargetMissing(false);
      layoutRef.current = EMPTY_LAYOUT;
      setLayout((prev) => ({ ...prev, ready: false }));

      await waitFrames(2);
      if (gen !== layoutGenRef.current) return;

      const targets = phaseTargetsRef.current;
      const el = await waitForTutorialTarget(targets, {
        timeoutMs: targets?.length ? 2200 : 0,
      });
      if (gen !== layoutGenRef.current) return;

      targetElRef.current = el;

      if (el && opts?.scroll !== false) {
        const inChrome =
          el.closest("[data-manager-more-sheet]") ||
          el.closest("[data-manager-mobile-nav]") ||
          isViewportFixedTarget(el);
        if (!inChrome) {
          const usable = measureUsableViewport({
            reserveStickyPlaybar: !el.closest(".mobile-action-bar"),
          });
          withProgrammaticScroll(() => {
            scrollTargetIntoUsableRegion(el, usable);
          });
          await waitFrames(2);
          if (gen !== layoutGenRef.current) return;
        }
      }

      // Measure first (in-flow), then elevate so ResizeObserver sees elevation as intentional.
      const actionRequired = needsTapRef.current;
      computeLayout(el, actionRequired);
      setTargetMissing(!el && Boolean(targets?.length));

      if (el && actionRequired && document.contains(el)) {
        elevationSignalRef.current++;
        clearElevation();
        unelevateRef.current = elevateTutorialTarget(el);
      }

      setTargetEpoch((n) => n + 1);
    },
    // phaseTargets read via phaseTargetsRef — keep this stable across phase-internal array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step?.id, computeLayout, withProgrammaticScroll, clearElevation]
  );

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Soft auto-nav only for non-interactive / content showcase steps.
  useEffect(() => {
    if (!step?.view) return;
    if (step.requireAction && step.action === "nav") return;
    if (step.requireAction && step.action === "open-more") return;
    if (phase === "content" || phase === "next") {
      if (currentView !== step.view) onNavigate(step.view);
    } else if (!step.requireAction) {
      onNavigate(step.view);
    }
    // currentView is intentionally not in deps — we only want to react to step/phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, step?.view, step?.requireAction, step?.action, phase, onNavigate]);

  // Skip mobile-only steps on desktop.
  useEffect(() => {
    if (!step?.mobileOnly) return;
    if (compact) return;
    onUpdate(advanceManagerTutorial(careerRef.current));
  }, [step?.id, step?.mobileOnly, compact, onUpdate]);

  // Advance when dedicated More step completes (menu opened).
  useEffect(() => {
    if (!step || step.action !== "open-more") return;
    if (!moreMenuOpen) {
      advancedMoreRef.current = null;
      return;
    }
    if (advancedMoreRef.current === step.id) return;
    advancedMoreRef.current = step.id;
    onUpdate(advanceManagerTutorial(careerRef.current));
  }, [step?.id, step?.action, moreMenuOpen, onUpdate]);

  // Publish tutorial lock so nav elevates + only the target stays tappable.
  useEffect(() => {
    const lock = step ? tutorialLockTargetForPhase(step, phase) : null;
    onTutorialLockChange(lock);
  }, [step?.id, phase, onTutorialLockChange]);

  useEffect(() => {
    return () => onTutorialLockChange(null);
  }, [onTutorialLockChange]);

  // Compact breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Scroll lock — acquire once for the tutorial lifetime.
  useEffect(() => {
    lockRef.current = acquireScrollLock("manager-tutorial");
    return () => {
      releaseScrollLock(lockRef.current);
      lockRef.current = null;
      onMoreMenuOpenChange(false);
      onTutorialLockChange(null);
    };
  }, [onMoreMenuOpenChange, onTutorialLockChange]);

  useEffect(() => {
    void syncTargetLayout({ scroll: true });
  }, [syncTargetLayout, phase]);

  useEffect(() => {
    return () => clearElevation();
  }, [clearElevation]);

  // Viewport / orientation — stable for the tutorial lifetime of this sync fn.
  useEffect(() => {
    let debounce: number | null = null;
    let orientationTimer: number | null = null;

    const runFullSync = () => {
      void syncTargetLayout({ scroll: true });
    };

    const onViewportChange = () => {
      if (debounce != null) window.clearTimeout(debounce);
      invalidateSafeInsetCache();
      debounce = window.setTimeout(() => {
        debounce = null;
        runFullSync();
      }, 120);
    };

    const onOrientation = () => {
      onViewportChange();
      if (orientationTimer != null) window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        orientationTimer = null;
        runFullSync();
      }, 280);
    };

    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("visibilitychange", onViewportChange);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onViewportChange);
    vv?.addEventListener("scroll", onViewportChange);

    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("visibilitychange", onViewportChange);
      vv?.removeEventListener("resize", onViewportChange);
      vv?.removeEventListener("scroll", onViewportChange);
      if (debounce != null) window.clearTimeout(debounce);
      if (orientationTimer != null) window.clearTimeout(orientationTimer);
    };
  }, [syncTargetLayout]);

  // Observe only the current target + callout panel; reattach when targetEpoch bumps.
  useEffect(() => {
    let debounce: number | null = null;
    let lastElevationSignal = elevationSignalRef.current;

    const refine = () => {
      const currentSignal = elevationSignalRef.current;
      if (currentSignal !== lastElevationSignal) {
        lastElevationSignal = currentSignal;
        return;
      }

      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        const el = targetElRef.current;
        if (el && document.contains(el)) {
          computeLayout(el, needsTapRef.current);
        } else if (phaseTargetsRef.current?.length) {
          void syncTargetLayout({ scroll: false });
        }
      }, 150);
    };

    const ro = new ResizeObserver(refine);
    if (targetElRef.current) ro.observe(targetElRef.current);
    if (panelRef.current) ro.observe(panelRef.current);

    return () => {
      if (debounce != null) window.clearTimeout(debounce);
      ro.disconnect();
    };
  }, [computeLayout, syncTargetLayout, targetEpoch, phaseTargetsKey]);

  // Keyboard trap.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        focusWithoutScroll(last);
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        focusWithoutScroll(first);
      }
    };
    window.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => {
      const btn = panelRef.current?.querySelector<HTMLElement>("button");
      focusWithoutScroll(btn ?? panelRef.current);
    });
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step?.id, phase]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    playUiClick();
    if (!step) return;
    if (step.id === "finish") {
      onUpdate(completeManagerTutorial(career));
      return;
    }
    onMoreMenuOpenChange(false);
    onUpdate(advanceManagerTutorial(career));
  }, [career, onUpdate, step, onMoreMenuOpenChange]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!step) return null;

  const allowNext = showNext || targetMissing;
  const waitingForTap = needsTap && !targetMissing;
  const blockers = holeBlockerPanels(
    waitingForTap ? layout.actionHole : null,
    vw || (typeof window !== "undefined" ? window.innerWidth : 0),
    vh || (typeof window !== "undefined" ? window.innerHeight : 0)
  );

  const showSpotlight = Boolean(layout.ready && layout.spotlight);
  const stepIndex = getManagerTutorialStepIndex(step.id);
  const stepTotal = getManagerTutorialStepCount(compact);
  const actionHint =
    phase === "open-more"
      ? "Tap ⋯ More in the bottom bar."
      : compact && phase === "action" && step.moreHint
        ? step.moreHint
        : step.hint ?? "Tap the highlighted control to continue.";

  return (
    <>
      <BodyPortal>
        <div
          className={`manager-tutorial-overlay pointer-events-none fixed inset-0 ${uiLayerClass("criticalAnimation")} overflow-hidden overscroll-none`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-tutorial-title"
        >
          {showSpotlight && layout.spotlight ? (
            <div
              aria-hidden
              className={`pointer-events-none absolute rounded-xl ring-2 ring-theme-primary/90 ${
                prefersReducedMotion()
                  ? ""
                  : "transition-[top,left,width,height] duration-[var(--motion-medium)] ease-[var(--motion-ease)]"
              }`}
              style={{
                top: layout.spotlight.top,
                left: layout.spotlight.left,
                width: layout.spotlight.width,
                height: layout.spotlight.height,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.78)",
                opacity: layout.ready ? 1 : 0,
              }}
            />
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black/80"
              style={{ opacity: layout.ready ? 1 : 0.92 }}
            />
          )}

          {blockers.map((panel, i) => (
            <div
              key={`block-${i}`}
              aria-hidden
              className="pointer-events-auto absolute"
              style={{
                top: panel.top,
                left: panel.left,
                width: panel.width,
                height: panel.height,
              }}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.preventDefault()}
            />
          ))}
        </div>
      </BodyPortal>
      <BodyPortal>
        {/* z is established by .manager-tutorial-callout-layer CSS class = 10003 */}
        <div className="manager-tutorial-callout-layer pointer-events-none fixed inset-0">
          <TutorialCallout
            step={step}
            needsAction={waitingForTap}
            actionHint={actionHint}
            showNext={allowNext}
            stepIndex={stepIndex}
            stepTotal={stepTotal}
            callout={layout.callout}
            panelRef={panelRef}
            onNext={goNext}
            visible={layout.ready}
          />
        </div>
      </BodyPortal>
    </>
  );
}

function TutorialCallout({
  step,
  needsAction,
  actionHint,
  showNext,
  stepIndex,
  stepTotal,
  callout,
  panelRef,
  onNext,
  visible,
}: {
  step: ManagerTutorialStepDef;
  needsAction: boolean;
  actionHint: string;
  showNext: boolean;
  stepIndex: number;
  stepTotal: number;
  callout: CalloutBox | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onNext: () => void;
  visible: boolean;
}) {
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="pointer-events-auto absolute outline-none overflow-hidden"
      style={{
        ...calloutStyle(callout),
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="rounded-xl border border-theme-primary/40 bg-pitch-950 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        <p className={`${TYPO.keyLabel} text-theme-primary`}>
          Step {stepIndex + 1} of {stepTotal}
        </p>
        <h2
          id="manager-tutorial-title"
          className="mt-1 text-[0.95rem] font-bold leading-snug text-white sm:text-base"
        >
          {step.title}
        </h2>
        <p className="mt-1 text-[0.8125rem] leading-snug text-pitch-300 sm:text-sm">
          {step.body}
        </p>
        {needsAction ? (
          <p className="mt-2 rounded-md border border-theme-primary/35 bg-theme-primary/10 px-2.5 py-1.5 text-[0.75rem] font-semibold leading-snug text-theme-primary">
            {actionHint}
          </p>
        ) : showNext ? (
          <div className="mt-2.5">
            <GameButton
              variant="theme"
              size="sm"
              className="min-h-10 min-w-[5.5rem]"
              onClick={onNext}
            >
              {step.nextLabel ?? "Next"}
            </GameButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function calloutStyle(callout: CalloutBox | null): CSSProperties {
  if (!callout) {
    return {
      left: "50%",
      top: "40%",
      transform: "translate(-50%, -50%)",
      width: "min(calc(100vw - 1.5rem), 21rem)",
    };
  }
  return {
    top: callout.top,
    left: callout.left,
    width: callout.width,
    maxHeight: callout.maxHeight,
    transform: "none",
  };
}
