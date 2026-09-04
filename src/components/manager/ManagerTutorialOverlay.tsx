"use client";

/**
 * Manager Mode tutorial overlay — rebuilt from zero.
 *
 * Guide only: highlight real controls, let the user click them, observe app state.
 * No scroll loops, no body lock, no fake navigation, no continuous measure loops.
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
  /** Club Office sub-tab from ManagerClub (authoritative). */
  clubOfficeTab?: "finances" | "boosts" | "facilities" | "settings" | null;
}

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const CALLOUT_GAP = 12;

function safeViewport(): { top: number; bottom: number; left: number; right: number } {
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

function rectInSafeArea(r: Rect, safe: ReturnType<typeof safeViewport>): boolean {
  return r.top >= safe.top - 2 && r.top + r.height <= safe.bottom + 2;
}

/** Smallest scroll needed to expose target — never centers the page. */
function minimalScrollIntoSafeArea(el: HTMLElement): void {
  const safe = safeViewport();
  const r = el.getBoundingClientRect();
  const top = r.top;
  const bottom = r.bottom;
  let delta = 0;
  if (top < safe.top) {
    delta = top - safe.top - 12;
  } else if (bottom > safe.bottom) {
    delta = bottom - safe.bottom + 12;
  }
  if (Math.abs(delta) < 4) return;
  window.scrollBy({ top: delta, left: 0, behavior: "auto" });
}

function holeBlockers(hole: Rect | null, vw: number, vh: number): Rect[] {
  if (!hole) {
    return [{ top: 0, left: 0, width: vw, height: vh }];
  }
  const top = Math.max(0, hole.top);
  const left = Math.max(0, hole.left);
  const right = Math.min(vw, hole.left + hole.width);
  const bottom = Math.min(vh, hole.top + hole.height);
  const panels: Rect[] = [];
  if (top > 0) panels.push({ top: 0, left: 0, width: vw, height: top });
  if (vh - bottom > 0) {
    panels.push({ top: bottom, left: 0, width: vw, height: vh - bottom });
  }
  if (bottom > top) {
    if (left > 0) {
      panels.push({ top, left: 0, width: left, height: bottom - top });
    }
    if (vw - right > 0) {
      panels.push({ top, left: right, width: vw - right, height: bottom - top });
    }
  }
  return panels;
}

function placeCallout(
  target: Rect | null,
  forceTop: boolean
): { top: number; left: number; width: number } {
  const safe = safeViewport();
  const width = Math.min(340, safe.right - safe.left);
  const height = 160;
  if (!target || forceTop) {
    return {
      top: safe.top,
      left: safe.left + (safe.right - safe.left - width) / 2,
      width,
    };
  }
  const below = target.top + target.height + CALLOUT_GAP;
  const above = target.top - CALLOUT_GAP - height;
  let top: number;
  if (below + height <= safe.bottom) top = below;
  else if (above >= safe.top) top = above;
  else top = safe.top;
  let left = target.left + target.width / 2 - width / 2;
  left = Math.max(safe.left, Math.min(left, safe.right - width));
  return { top, left, width };
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
  const [callout, setCallout] = useState(() => placeCallout(null, true));
  const [chrome, setChrome] = useState(false);
  const [found, setFound] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  const targetElRef = useRef<HTMLElement | null>(null);
  const scrolledForKeyRef = useRef<string | null>(null);
  const advancedKeyRef = useRef<string | null>(null);
  const careerRef = useRef(career);
  careerRef.current = career;
  const panelRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback((el: HTMLElement | null, asChrome: boolean) => {
    const vv = window.visualViewport;
    setVw(vv?.width ?? window.innerWidth);
    setVh(vv?.height ?? window.innerHeight);
    if (!el) {
      setSpotlight(null);
      setCallout(placeCallout(null, true));
      setChrome(false);
      return;
    }
    const rect = padRect(el.getBoundingClientRect());
    setSpotlight(rect);
    setChrome(asChrome);
    setCallout(placeCallout(rect, asChrome));
  }, []);

  const sync = useCallback(
    (opts?: { allowScroll?: boolean }) => {
      if (!step) return;
      const id = targetId;
      const hit = resolveTutorialTarget(id);
      setMatchCount(hit.matchCount);
      setFound(Boolean(hit.el));
      targetElRef.current = hit.el;

      if (!hit.el) {
        measure(null, false);
        return;
      }

      const isChrome = isTutorialChromeElement(hit.el);
      const key = `${step.id}:${id}`;

      // Scroll at most once per step/target — only if target is off-screen.
      if (opts?.allowScroll && scrolledForKeyRef.current !== key && !isChrome) {
        const safe = safeViewport();
        const r = padRect(hit.el.getBoundingClientRect());
        if (!rectInSafeArea(r, safe)) {
          minimalScrollIntoSafeArea(hit.el);
        }
        scrolledForKeyRef.current = key;
        // One remasure after scroll (no loop).
        requestAnimationFrame(() => {
          if (targetElRef.current === hit.el) {
            measure(hit.el, isChrome);
          }
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

  // Advance when real expected state is met (click / open-menu).
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

  // Publish nav lock so only the taught control stays interactive + elevated.
  useEffect(() => {
    if (!step) {
      onTutorialLockChange(null);
      return;
    }
    onTutorialLockChange(tutorialNavLockForStep(step, ctx));
  }, [step, ctx, onTutorialLockChange]);

  useEffect(() => () => onTutorialLockChange(null), [onTutorialLockChange]);

  // Resolve target when step / app state changes.
  useEffect(() => {
    scrolledForKeyRef.current = null;
    const t = window.setTimeout(() => sync({ allowScroll: true }), 40);
    return () => window.clearTimeout(t);
  }, [sync, step?.id, targetId, currentView, moreMenuOpen]);

  // Remeasure on resize / user scroll — never auto-scroll here.
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

  // Escape never dismisses.
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
  // Chrome: full blockers (elevated control sits above). In-page: hole.
  const blockers = holeBlockers(
    waiting && spotlight && !chrome ? spotlight : null,
    vw || (typeof window !== "undefined" ? window.innerWidth : 0),
    vh || (typeof window !== "undefined" ? window.innerHeight : 0)
  );

  // Missing inspect target → still allow Next so the player is never stuck.
  const allowNext = showNext || (step.action === "inspect" && !found && Boolean(step.targetId));
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
      <BodyPortal>
        <div
          className={`manager-tutorial-overlay pointer-events-none fixed inset-0 ${uiLayerClass("criticalAnimation")} overflow-hidden`}
          role="dialog"
          aria-modal="true"
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

          {blockers.map((p, i) => (
            <div
              key={i}
              aria-hidden
              className="pointer-events-auto absolute"
              style={{
                top: p.top,
                left: p.left,
                width: p.width,
                height: p.height,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
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
            className="pointer-events-none fixed bottom-2 left-2 z-[10050] max-w-[min(100vw-1rem,20rem)] rounded border border-lime-500/50 bg-black/90 p-2 font-mono text-[10px] leading-snug text-lime-200"
            aria-hidden
          >
            <div className="font-bold text-lime-300">Tutorial debug</div>
            <div>Step: {step.id}</div>
            <div>Target: {targetId ?? "(none)"}</div>
            <div>
              Found: {found ? "YES" : "NO"} · Matches: {matchCount}
            </div>
            <div>
              Tab: {currentView} · More: {moreMenuOpen ? "OPEN" : "closed"}
              {clubOfficeTab ? ` · Club: ${clubOfficeTab}` : ""}
            </div>
            <div>
              Expected:{" "}
              {step.expected
                ? JSON.stringify(step.expected)
                : "—"}
            </div>
            <div>Chrome: {chrome ? "YES" : "NO"} · Compact: {compact ? "YES" : "NO"}</div>
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
