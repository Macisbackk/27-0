"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  resolveTutorialTargetElement,
  tutorialStepNeedsAction,
  type ManagerTutorialStepDef,
} from "@/lib/manager/managerTutorial";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { acquireScrollLock, releaseScrollLock } from "@/lib/ui/scroll-lock";
import { uiLayerClass } from "@/lib/ui/layers";
import { focusWithoutScroll } from "@/lib/ui/focus";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

const PAD = 8;

interface ManagerTutorialOverlayProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  onNavigate: (view: ManagerView) => void;
}

type CalloutPlacement = "above" | "below" | "center";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ManagerTutorialOverlay({
  career,
  onUpdate,
  onNavigate,
}: ManagerTutorialOverlayProps) {
  const step = getActiveManagerTutorialStep(career);
  const needsAction = tutorialStepNeedsAction(career, step);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef<ReturnType<typeof acquireScrollLock> | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [placement, setPlacement] = useState<CalloutPlacement>("center");

  const measure = useCallback(() => {
    if (!step) {
      setTargetRect(null);
      return;
    }
    const el = resolveTutorialTargetElement(step.targets);
    if (!el) {
      setTargetRect(null);
      setPlacement("center");
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
      setPlacement("below");
    } else if (spaceAbove >= 140) {
      setPlacement("above");
    } else {
      setPlacement("center");
    }
    try {
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    } catch {
      /* ignore */
    }
  }, [step]);

  useLayoutEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const interval = window.setInterval(measure, 350);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.clearInterval(interval);
    };
  }, [measure, career.tutorialStep]);

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

  return (
    <BodyPortal>
      <div
        className={`manager-tutorial-overlay fixed inset-0 ${uiLayerClass("criticalAnimation")} overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-tutorial-title"
        onClick={(e) => e.stopPropagation()}
      >
        {targetRect ? (
          <div
            aria-hidden
            className={`pointer-events-none absolute rounded-xl ring-2 ring-theme-primary ${
              prefersReducedMotion()
                ? ""
                : "transition-[top,left,width,height] duration-200"
            }`}
            style={{
              top: Math.max(0, targetRect.top - PAD),
              left: Math.max(0, targetRect.left - PAD),
              width: targetRect.width + PAD * 2,
              height: targetRect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.78)",
            }}
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-black/80" />
        )}

        {/* Full-screen interaction block (spotlight hit-area sits above this). */}
        <div className="absolute inset-0" aria-hidden />

        {needsAction && targetRect ? (
          <button
            type="button"
            aria-label="Continue tutorial"
            className="absolute z-[2] rounded-xl border-2 border-theme-primary/90 bg-theme-primary/15"
            style={{
              top: Math.max(0, targetRect.top - PAD),
              left: Math.max(0, targetRect.left - PAD),
              width: targetRect.width + PAD * 2,
              height: targetRect.height + PAD * 2,
            }}
            onClick={goNext}
          />
        ) : null}

        <TutorialCallout
          step={step}
          needsAction={needsAction}
          stepIndex={Math.max(0, stepIndex)}
          stepTotal={stepTotal}
          placement={placement}
          targetRect={targetRect}
          panelRef={panelRef}
          onNext={goNext}
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
  placement,
  targetRect,
  panelRef,
  onNext,
}: {
  step: ManagerTutorialStepDef;
  needsAction: boolean;
  stepIndex: number;
  stepTotal: number;
  placement: CalloutPlacement;
  targetRect: DOMRect | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onNext: () => void;
}) {
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="absolute z-[3] w-[min(calc(100vw-1.5rem),22rem)] outline-none"
      style={calloutStyle(placement, targetRect)}
    >
      <div className="rounded-xl border border-theme-primary/40 bg-pitch-950 px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between gap-2">
          <p className={`${TYPO.keyLabel} text-theme-primary`}>
            Tutorial · {stepIndex + 1}/{stepTotal}
          </p>
        </div>
        <h2
          id="manager-tutorial-title"
          className="mt-1.5 text-base font-bold leading-snug text-white"
        >
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-pitch-300">{step.body}</p>
        {step.hint ? (
          <p className="mt-1.5 text-xs leading-snug text-pitch-400">{step.hint}</p>
        ) : null}
        {needsAction ? (
          <p className="mt-2.5 rounded-md border border-theme-primary/35 bg-theme-primary/10 px-2.5 py-2 text-xs font-semibold text-theme-primary">
            Tap the highlighted control to continue.
          </p>
        ) : (
          <div className="mt-3">
            <GameButton variant="theme" size="sm" onClick={onNext}>
              {step.nextLabel ?? "Next"}
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
}

function calloutStyle(
  placement: CalloutPlacement,
  targetRect: DOMRect | null
): CSSProperties {
  if (!targetRect || placement === "center") {
    return {
      left: "50%",
      top: "42%",
      transform: "translate(-50%, -50%)",
    };
  }

  if (placement === "below") {
    const top = Math.min(
      targetRect.bottom + 12,
      typeof window !== "undefined" ? window.innerHeight - 210 : 400
    );
    return {
      left: "50%",
      transform: "translateX(-50%)",
      top,
    };
  }

  const bottom =
    typeof window !== "undefined"
      ? Math.max(80, window.innerHeight - targetRect.top + 12)
      : 80;
  return {
    left: "50%",
    transform: "translateX(-50%)",
    bottom,
    top: "auto",
  };
}
