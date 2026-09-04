"use client";

/**
 * Manager Mode tutorial overlay — rebuilt from scratch.
 *
 * Architecture:
 * - Career owns step ID (single source of truth).
 * - Phase derives from step + viewport + moreOpen + currentView.
 * - Geometry lives in refs; React state updates only on material change.
 * - Click-through via hole blockers only (no DOM elevation / style surgery).
 * - No continuous rAF / observer chase loops.
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
  isTutorialCompactViewport,
  resolveTutorialInteractionPhase,
  resolveTutorialPhaseTargets,
  tutorialCanRequireAdvanceWeek,
  tutorialDebugLog,
  tutorialLockTargetForPhase,
  tutorialPhaseNeedsTap,
  waitForTutorialTarget,
  type ManagerTutorialNavLock,
  type ManagerTutorialStepDef,
} from "@/lib/manager/managerTutorial";
import { isManagerMobileMoreNavView } from "@/lib/manager/manager-nav-config";
import {
  calloutMateriallyChanged,
  holeBlockerPanels,
  invalidateSafeInsetCache,
  isViewportFixedTarget,
  layoutRectFromElement,
  measureUsableViewport,
  placeTutorialCallout,
  rectMateriallyChanged,
  scrollTargetIntoUsableRegion,
  spotlightRectForTarget,
  waitFrames,
  type CalloutBox,
  type LayoutRect,
} from "@/lib/manager/tutorialGeometry";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { acquireScrollLock, releaseScrollLock } from "@/lib/ui/scroll-lock";
import { uiLayerClass } from "@/lib/ui/layers";
import { focusWithoutScroll } from "@/lib/ui/focus";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface ManagerTutorialOverlayProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  onNavigate: (view: ManagerView) => void;
  currentView: ManagerView;
  moreMenuOpen: boolean;
  onMoreMenuOpenChange: (open: boolean) => void;
  onTutorialLockChange: (lock: ManagerTutorialNavLock) => void;
}

type LayoutState = {
  spotlight: LayoutRect | null;
  callout: CalloutBox | null;
  actionHole: LayoutRect | null;
  /** True once this step/phase has a committed layout (or confirmed no target). */
  settled: boolean;
};

const EMPTY_LAYOUT: LayoutState = {
  spotlight: null,
  callout: null,
  actionHole: null,
  settled: false,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
    () => (step ? resolveTutorialPhaseTargets(step, phase, compact) : undefined),
    [step, phase, compact]
  );
  const phaseTargetsKey = phaseTargets?.join(",") ?? "";
  const needsTap = Boolean(step && tutorialPhaseNeedsTap(phase));
  const showNext =
    Boolean(step) &&
    (phase === "next" ||
      phase === "content" ||
      (step?.action === "advance-week" &&
        !tutorialCanRequireAdvanceWeek(career)));

  const panelRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef<ReturnType<typeof acquireScrollLock> | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef<LayoutState>(EMPTY_LAYOUT);
  const syncGenRef = useRef(0);
  const advancedMoreRef = useRef<string | null>(null);
  const careerRef = useRef(career);
  careerRef.current = career;
  const needsTapRef = useRef(needsTap);
  needsTapRef.current = needsTap;
  const phaseTargetsRef = useRef(phaseTargets);
  phaseTargetsRef.current = phaseTargets;

  const [layout, setLayout] = useState<LayoutState>(EMPTY_LAYOUT);
  const [targetMissing, setTargetMissing] = useState(false);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  const commitLayout = useCallback((next: LayoutState, viewW: number, viewH: number) => {
    const prev = layoutRef.current;
    if (
      prev.settled &&
      next.settled &&
      !rectMateriallyChanged(prev.spotlight, next.spotlight) &&
      !calloutMateriallyChanged(prev.callout, next.callout) &&
      Boolean(prev.actionHole) === Boolean(next.actionHole)
    ) {
      return;
    }
    layoutRef.current = next;
    setVw(viewW);
    setVh(viewH);
    setLayout(next);
  }, []);

  const measureTarget = useCallback(
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
        commitLayout(
          {
            spotlight: null,
            callout: {
              top: usable.top + Math.max(0, (usable.height - height) * 0.28),
              left: usable.left + (usable.width - width) / 2,
              width,
              maxHeight: usable.height,
              placement: "dock-top",
            },
            actionHole: null,
            settled: true,
          },
          viewW,
          viewH
        );
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
        { width: measuredW, height: measuredH },
        layoutRef.current.settled ? layoutRef.current.callout?.placement : null
      );

      commitLayout(
        {
          spotlight,
          callout,
          actionHole: actionRequired ? spotlight : null,
          settled: true,
        },
        viewW,
        viewH
      );
    },
    [commitLayout]
  );

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

  const syncTarget = useCallback(
    async (opts?: { scroll?: boolean }) => {
      if (!step) {
        targetElRef.current = null;
        layoutRef.current = EMPTY_LAYOUT;
        setLayout(EMPTY_LAYOUT);
        setTargetMissing(false);
        return;
      }

      const gen = ++syncGenRef.current;
      const targets = phaseTargetsRef.current;
      tutorialDebugLog("sync-start", {
        step: step.id,
        phase,
        targets,
        scroll: opts?.scroll !== false,
      });

      // Hold previous spotlight while resolving — avoid blank flicker.
      setTargetMissing(false);

      await waitFrames(1);
      if (gen !== syncGenRef.current) return;

      const el = await waitForTutorialTarget(targets, {
        timeoutMs: targets?.length ? 2000 : 0,
      });
      if (gen !== syncGenRef.current) return;

      targetElRef.current = el;
      tutorialDebugLog("target-resolved", {
        step: step.id,
        found: Boolean(el),
        id: el?.getAttribute("data-tutorial-target"),
      });

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
          if (gen !== syncGenRef.current) return;
        }
      }

      measureTarget(el, needsTapRef.current);
      setTargetMissing(!el && Boolean(targets?.length));
    },
    // phase is logged only; targets come from ref keyed by step/phase via effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step?.id, measureTarget, withProgrammaticScroll]
  );

  // Soft auto-nav for inspect / content steps only.
  useEffect(() => {
    if (!step?.view) return;
    if (step.requireAction && step.action === "nav") return;
    if (step.requireAction && step.action === "open-more") return;
    if (phase === "content" || phase === "next") {
      if (currentView !== step.view) onNavigate(step.view);
    } else if (!step.requireAction) {
      onNavigate(step.view);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, step?.view, step?.requireAction, step?.action, phase, onNavigate]);

  // Skip mobile-only steps on desktop.
  useEffect(() => {
    if (!step?.mobileOnly || compact) return;
    onUpdate(advanceManagerTutorial(careerRef.current));
  }, [step?.id, step?.mobileOnly, compact, onUpdate]);

  // Advance dedicated More step when menu opens.
  useEffect(() => {
    if (!step || step.action !== "open-more") return;
    if (!moreMenuOpen) {
      advancedMoreRef.current = null;
      return;
    }
    if (advancedMoreRef.current === step.id) return;
    advancedMoreRef.current = step.id;
    tutorialDebugLog("more-opened-advance", { step: step.id });
    onUpdate(advanceManagerTutorial(careerRef.current));
  }, [step?.id, step?.action, moreMenuOpen, onUpdate]);

  // Publish nav lock (disable other tabs — no z-index elevate required).
  useEffect(() => {
    const lock = step ? tutorialLockTargetForPhase(step, phase) : null;
    onTutorialLockChange(lock);
  }, [step?.id, phase, onTutorialLockChange]);

  useEffect(() => {
    return () => onTutorialLockChange(null);
  }, [onTutorialLockChange]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Scroll lock once for tutorial lifetime.
  useEffect(() => {
    lockRef.current = acquireScrollLock("manager-tutorial");
    return () => {
      releaseScrollLock(lockRef.current);
      lockRef.current = null;
      onMoreMenuOpenChange(false);
      onTutorialLockChange(null);
    };
  }, [onMoreMenuOpenChange, onTutorialLockChange]);

  // Resolve target when step/phase/targets change.
  useEffect(() => {
    void syncTarget({ scroll: true });
  }, [syncTarget, phase, phaseTargetsKey]);

  // Viewport resize / orientation — remasure only (no scroll unless target lost).
  useEffect(() => {
    let debounce: number | null = null;
    let orientationTimer: number | null = null;

    const remasure = () => {
      invalidateSafeInsetCache();
      const el = targetElRef.current;
      if (el && document.contains(el)) {
        measureTarget(el, needsTapRef.current);
      } else if (phaseTargetsRef.current?.length) {
        void syncTarget({ scroll: false });
      }
    };

    const onViewportChange = () => {
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        remasure();
      }, 140);
    };

    const onOrientation = () => {
      onViewportChange();
      if (orientationTimer != null) window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        orientationTimer = null;
        void syncTarget({ scroll: true });
      }, 300);
    };

    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onOrientation);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onViewportChange);
    // Do NOT listen to visualViewport scroll — that caused resync loops.

    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onOrientation);
      vv?.removeEventListener("resize", onViewportChange);
      if (debounce != null) window.clearTimeout(debounce);
      if (orientationTimer != null) window.clearTimeout(orientationTimer);
    };
  }, [measureTarget, syncTarget]);

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

  const goNext = useCallback(() => {
    playUiClick();
    if (!step) return;
    if (step.id === "finish") {
      onUpdate(completeManagerTutorial(career));
      return;
    }
    // Keep More open when advancing into fixtures/stats that need the sheet.
    const nextCareer = advanceManagerTutorial(career);
    const nextStep = getActiveManagerTutorialStep(nextCareer);
    const nextNeedsMore =
      compact &&
      nextStep?.action === "nav" &&
      nextStep.navView != null &&
      isManagerMobileMoreNavView(nextStep.navView);
    if (!nextNeedsMore) onMoreMenuOpenChange(false);
    onUpdate(nextCareer);
  }, [career, onUpdate, step, onMoreMenuOpenChange, compact]);

  if (!step) return null;

  const allowNext = showNext || targetMissing;
  const waitingForTap = needsTap && !targetMissing && layout.settled;
  const blockers = holeBlockerPanels(
    waitingForTap ? layout.actionHole : null,
    vw || (typeof window !== "undefined" ? window.innerWidth : 0),
    vh || (typeof window !== "undefined" ? window.innerHeight : 0)
  );

  const showSpotlight = Boolean(layout.settled && layout.spotlight);
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
              }}
            />
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black/80"
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
            visible={layout.settled}
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
