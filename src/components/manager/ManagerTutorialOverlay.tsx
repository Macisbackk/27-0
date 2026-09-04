"use client";

/**
 * Manager Mode tutorial overlay.
 *
 * Hit-testing architecture (critical):
 * - Visual dim/spotlight: pointer-events none only.
 * - Outside the target: four blocker panels (pointer-events auto).
 * - Over the target: NO blocker — events fall through the portal to the
 *   REAL application control underneath (Squad button, More, etc.).
 * - Never rely on elevating nav above the overlay: app chrome often lives
 *   inside a lower stacking context, so z-index elevation fails and a
 *   full-screen blocker would eat the click.
 * - Callout is interactive but docked away from the target.
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

/** Only for in-flow page content — never for fixed nav / More. */
function minimalScrollIntoSafeArea(el: HTMLElement): void {
  const safe = safeViewport();
  const r = el.getBoundingClientRect();
  let delta = 0;
  if (r.top < safe.top) delta = r.top - safe.top - 12;
  else if (r.bottom > safe.bottom) delta = r.bottom - safe.bottom + 12;
  if (Math.abs(delta) < 4) return;
  window.scrollBy({ top: delta, left: 0, behavior: "auto" });
}

/** Four panels around a hole. Null hole = full-screen lock (no target yet). */
function holeBlockerPanels(hole: Rect | null, vw: number, vh: number): Rect[] {
  if (!hole || hole.width < 2 || hole.height < 2) {
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
      panels.push({
        top,
        left: right,
        width: vw - right,
        height: bottom - top,
      });
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
  // Never leave the callout covering the tap target.
  if (
    top < target.top + target.height &&
    top + height > target.top
  ) {
    return {
      top: safe.top,
      left: safe.left + (safe.right - safe.left - width) / 2,
      width,
    };
  }
  return { top, left, width };
}

function describeEl(el: Element | null): string {
  if (!(el instanceof HTMLElement)) return String(el);
  const id = el.getAttribute("data-tutorial-target");
  const tag = el.tagName.toLowerCase();
  const cls = (el.className && String(el.className).slice(0, 60)) || "";
  const text = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);
  return id
    ? `${tag}[data-tutorial-target=${id}] "${text}"`
    : `${tag}.${cls} "${text}"`;
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
  const [hitTest, setHitTest] = useState<string>("—");
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  const targetElRef = useRef<HTMLElement | null>(null);
  const scrolledForKeyRef = useRef<string | null>(null);
  const advancedKeyRef = useRef<string | null>(null);
  const careerRef = useRef(career);
  careerRef.current = career;
  const panelRef = useRef<HTMLDivElement | null>(null);

  const runHitTest = useCallback((el: HTMLElement | null, rect: Rect | null) => {
    if (!debug || !el || !rect) {
      setHitTest("—");
      return;
    }
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const stack = document
      .elementsFromPoint(x, y)
      .slice(0, 6)
      .map(describeEl)
      .join(" → ");
    const pe = window.getComputedStyle(el).pointerEvents;
    const ok =
      top === el ||
      (top instanceof Node && el.contains(top)) ||
      (top instanceof HTMLElement &&
        top.closest(`[data-tutorial-target="${el.getAttribute("data-tutorial-target")}"]`) ===
          el);
    setHitTest(
      `${ok ? "OK" : "BLOCKED"} @(${Math.round(x)},${Math.round(y)}) top=${describeEl(top)} | pe=${pe} | stack: ${stack}`
    );
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error("[manager-tutorial] hit-test FAIL", {
        target: describeEl(el),
        top: describeEl(top),
        stack,
      });
    }
  }, [debug]);

  const measure = useCallback(
    (el: HTMLElement | null, asChrome: boolean) => {
      const vv = window.visualViewport;
      setVw(vv?.width ?? window.innerWidth);
      setVh(vv?.height ?? window.innerHeight);
      if (!el) {
        setSpotlight(null);
        setCallout(placeCallout(null, true));
        setChrome(false);
        runHitTest(null, null);
        return;
      }
      const rect = padRect(el.getBoundingClientRect());
      setSpotlight(rect);
      setChrome(asChrome);
      // Always dock callout away from interactive targets so it cannot steal clicks.
      setCallout(placeCallout(rect, asChrome || needsTap));
      runHitTest(el, rect);
    },
    [runHitTest, needsTap]
  );

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

      // Never page-scroll for fixed chrome (bottom nav / More / desktop tabs).
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
          if (targetElRef.current === hit.el) {
            measure(hit.el, isChrome);
          }
        });
      }

      measure(hit.el, isChrome);
    },
    [step, targetId, measure]
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!step?.mobileOnly || compact) return;
    onUpdate(advanceManagerTutorial(careerRef.current));
  }, [step?.id, step?.mobileOnly, compact, onUpdate]);

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

  useEffect(() => {
    if (!step) {
      onTutorialLockChange(null);
      return;
    }
    onTutorialLockChange(tutorialNavLockForStep(step, ctx));
  }, [step, ctx, onTutorialLockChange]);

  useEffect(() => () => onTutorialLockChange(null), [onTutorialLockChange]);

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
  const viewW = vw || (typeof window !== "undefined" ? window.innerWidth : 0);
  const viewH = vh || (typeof window !== "undefined" ? window.innerHeight : 0);

  /**
   * Interactive step with a measured target → cut a hole so the REAL control
   * receives the click (chrome and in-page alike). Full-screen blockers only
   * when there is nothing to tap yet (or inspect/Next-only).
   */
  const blockers = holeBlockerPanels(
    waiting && spotlight ? spotlight : null,
    viewW,
    viewH
  );

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
              data-tutorial-blocker=""
              className="pointer-events-auto absolute"
              style={{
                top: p.top,
                left: p.left,
                width: p.width,
                height: p.height,
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
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
            className="pointer-events-none fixed bottom-2 left-2 z-[10050] max-w-[min(100vw-1rem,22rem)] rounded border border-lime-500/50 bg-black/90 p-2 font-mono text-[10px] leading-snug text-lime-200"
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
