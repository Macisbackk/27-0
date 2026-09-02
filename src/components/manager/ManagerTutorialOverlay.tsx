"use client";

import {
  useCallback,
  useEffect,
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
  tutorialStepNeedsAction,
  waitForTutorialTarget,
  type ManagerTutorialStepDef,
} from "@/lib/manager/managerTutorial";
import {
  holeBlockerPanels,
  isViewportFixedTarget,
  layoutRectFromElement,
  measureUsableViewport,
  placeTutorialCallout,
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

interface ManagerTutorialOverlayProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  onNavigate: (view: ManagerView) => void;
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
}: ManagerTutorialOverlayProps) {
  const step = getActiveManagerTutorialStep(career);
  const needsAction = tutorialStepNeedsAction(career, step);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef<ReturnType<typeof acquireScrollLock> | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const layoutGenRef = useRef(0);
  const [layout, setLayout] = useState<LayoutState>(EMPTY_LAYOUT);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  /** Overflow is locked; temporarily allow programmatic document scroll. */
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

  const computeLayout = useCallback(
    (el: HTMLElement | null, actionRequired: boolean) => {
      const vv = window.visualViewport;
      const viewW = vv?.width ?? window.innerWidth;
      const viewH = vv?.height ?? window.innerHeight;
      setVw(viewW);
      setVh(viewH);

      if (!el) {
        const usable = measureUsableViewport();
        const width = Math.min(usable.width, usable.isCompact ? 340 : 360);
        const height = Math.min(
          panelRef.current?.offsetHeight || 180,
          usable.height
        );
        setLayout({
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
        });
        return;
      }

      const reservePlaybar =
        !isViewportFixedTarget(el) && !el.closest(".mobile-action-bar");
      const usable = measureUsableViewport({
        reserveStickyPlaybar: reservePlaybar,
      });
      const target = layoutRectFromElement(el);
      const spotlight = spotlightRectForTarget(target, usable);

      const measuredH = panelRef.current?.offsetHeight || (usable.isCompact ? 168 : 190);
      const measuredW = Math.min(usable.width, usable.isCompact ? 340 : 360);
      const callout = placeTutorialCallout(target, usable, {
        width: measuredW,
        height: measuredH,
      });

      setLayout({
        spotlight,
        callout,
        actionHole: actionRequired ? spotlight : null,
        ready: true,
      });
    },
    []
  );

  const syncTargetLayout = useCallback(
    async (opts?: { scroll?: boolean }) => {
      if (!step) {
        setLayout(EMPTY_LAYOUT);
        targetElRef.current = null;
        return;
      }

      const gen = ++layoutGenRef.current;
      setLayout((prev) => ({ ...prev, ready: false }));

      await waitFrames(2);
      if (gen !== layoutGenRef.current) return;

      const el = await waitForTutorialTarget(step.targets, {
        timeoutMs: step.targets?.length ? 2000 : 0,
      });
      if (gen !== layoutGenRef.current) return;

      targetElRef.current = el;

      if (el && opts?.scroll !== false) {
        const reservePlaybar =
          !isViewportFixedTarget(el) && !el.closest(".mobile-action-bar");
        const usable = measureUsableViewport({
          reserveStickyPlaybar: reservePlaybar,
        });
        withProgrammaticScroll(() => {
          scrollTargetIntoUsableRegion(el, usable);
        });
        await waitFrames(2);
        if (gen !== layoutGenRef.current) return;
      }

      computeLayout(el, tutorialStepNeedsAction(career, step));

      // Second pass after callout paints — height is accurate for placement.
      requestAnimationFrame(() => {
        if (gen !== layoutGenRef.current) return;
        computeLayout(targetElRef.current, tutorialStepNeedsAction(career, step));
      });
    },
    [step, career, computeLayout, withProgrammaticScroll]
  );

  useEffect(() => {
    if (!step?.view) return;
    onNavigate(step.view);
  }, [step?.id, step?.view, onNavigate]);

  useEffect(() => {
    lockRef.current = acquireScrollLock("manager-tutorial");
    return () => {
      releaseScrollLock(lockRef.current);
      lockRef.current = null;
    };
  }, []);

  useEffect(() => {
    void syncTargetLayout({ scroll: true });
  }, [syncTargetLayout, career.tutorialStep, needsAction]);

  useEffect(() => {
    let debounce: number | null = null;
    let orientationTimer: number | null = null;

    const runFullSync = () => {
      void syncTargetLayout({ scroll: true });
    };

    const onViewportChange = () => {
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        runFullSync();
      }, 60);
    };

    const onOrientation = () => {
      // Mobile browsers often update visualViewport after orientationchange.
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

    const refine = () => {
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        const el = targetElRef.current;
        if (el && document.contains(el)) {
          computeLayout(el, needsAction);
        } else if (step?.targets?.length) {
          void syncTargetLayout({ scroll: false });
        }
      }, 100);
    };

    const ro = new ResizeObserver(refine);
    if (targetElRef.current) ro.observe(targetElRef.current);
    if (panelRef.current) ro.observe(panelRef.current);
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("visibilitychange", onViewportChange);
      vv?.removeEventListener("resize", onViewportChange);
      vv?.removeEventListener("scroll", onViewportChange);
      if (debounce != null) window.clearTimeout(debounce);
      if (orientationTimer != null) window.clearTimeout(orientationTimer);
      ro.disconnect();
    };
  }, [syncTargetLayout, computeLayout, needsAction, step?.id, layout.ready]);

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
  }, [step?.id]);

  const goNext = useCallback(() => {
    playUiClick();
    if (!step) return;
    if (step.id === "finish") {
      onUpdate(completeManagerTutorial(career));
      return;
    }
    onUpdate(advanceManagerTutorial(career));
  }, [career, onUpdate, step]);

  if (!step) return null;

  const stepIndex = [
    "welcome",
    "hub",
    "season-progress",
    "fixture",
    "squad",
    "reserves",
    "contracts",
    "transfers",
    "fixtures",
    "stats",
    "cup",
    "playoffs",
    "finish",
  ].indexOf(step.id);
  const stepTotal = 13;

  const blockers = holeBlockerPanels(
    needsAction ? layout.actionHole : null,
    vw || (typeof window !== "undefined" ? window.innerWidth : 0),
    vh || (typeof window !== "undefined" ? window.innerHeight : 0)
  );

  const showSpotlight = Boolean(layout.ready && layout.spotlight);

  return (
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

        <TutorialCallout
          step={step}
          needsAction={needsAction}
          stepIndex={Math.max(0, stepIndex)}
          stepTotal={stepTotal}
          callout={layout.callout}
          panelRef={panelRef}
          onNext={goNext}
          visible={layout.ready}
        />
      </div>
    </BodyPortal>
  );
}

function TutorialCallout({
  step,
  needsAction,
  stepIndex,
  stepTotal,
  callout,
  panelRef,
  onNext,
  visible,
}: {
  step: ManagerTutorialStepDef;
  needsAction: boolean;
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
      className="pointer-events-auto absolute z-[3] outline-none overflow-hidden"
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
            {step.hint ?? "Tap the highlighted control to continue."}
          </p>
        ) : (
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
        )}
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
