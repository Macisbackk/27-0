"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import {
  acquireScrollLock,
  releaseScrollLock,
  type ScrollLockId,
} from "@/lib/ui/scroll-lock";
import { TYPO } from "@/lib/ui/typography";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type CalendarSimAnimationPhase =
  | "idle"
  | "processing"
  | "animating"
  | "complete"
  | "error";

export interface CalendarSimAnimationProps {
  open: boolean;
  startDateKey: string | null;
  /** Actual reached date (may differ from requested if sim stopped early). */
  reachedDateKey: string | null;
  status: CalendarSimAnimationPhase;
  statusMessage?: string | null;
  onDismiss: () => void;
}

function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatDateKey(key: string): string {
  const p = parseDateKey(key);
  if (!p) return key;
  return `${p.d} ${MONTH_NAMES[p.m - 1]} ${p.y}`;
}

/** Sample start → few intermediate → end for a concise flip animation. */
function buildDateTrail(start: string, end: string): string[] {
  if (start === end) return [end];
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  if (!a || !b) return [start, end];

  const startUtc = Date.UTC(a.y, a.m - 1, a.d);
  const endUtc = Date.UTC(b.y, b.m - 1, b.d);
  const dayMs = 86_400_000;
  const days = Math.max(0, Math.round((endUtc - startUtc) / dayMs));

  if (days <= 2) return [start, end];
  if (days <= 14) {
    const mid = new Date(startUtc + Math.round(days / 2) * dayMs);
    return [
      start,
      `${mid.getUTCFullYear()}-${String(mid.getUTCMonth() + 1).padStart(2, "0")}-${String(mid.getUTCDate()).padStart(2, "0")}`,
      end,
    ];
  }

  const trail: string[] = [start];
  const steps = Math.min(4, Math.ceil(days / 7));
  for (let i = 1; i < steps; i++) {
    const t = startUtc + Math.round((days * i) / steps) * dayMs;
    const dt = new Date(t);
    trail.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
    );
  }
  if (trail[trail.length - 1] !== end) trail.push(end);
  return trail;
}

/**
 * Compact calendar progression for Sim to Date — presentation only.
 * Must finish on the real reached date from the simulation result.
 * Centred viewport overlay; scroll locked while open.
 */
export function CalendarSimAnimation({
  open,
  startDateKey,
  reachedDateKey,
  status,
  statusMessage,
  onDismiss,
}: CalendarSimAnimationProps) {
  const scrollLockIdRef = useRef<ScrollLockId | null>(null);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const trail = useMemo(() => {
    if (!startDateKey || !reachedDateKey) return [];
    return buildDateTrail(startDateKey, reachedDateKey);
  }, [startDateKey, reachedDateKey]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      releaseScrollLock(scrollLockIdRef.current);
      scrollLockIdRef.current = null;
      return;
    }
    if (!scrollLockIdRef.current) {
      scrollLockIdRef.current = acquireScrollLock("calendar-sim");
    }
    return () => {
      releaseScrollLock(scrollLockIdRef.current);
      scrollLockIdRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open || status !== "animating" || trail.length === 0) {
      setIndex(0);
      return;
    }
    if (prefersReduced || trail.length <= 1) {
      setIndex(trail.length - 1);
      return;
    }
    setIndex(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= trail.length) {
        window.clearInterval(id);
        setIndex(trail.length - 1);
        return;
      }
      setIndex(i);
    }, 280);
    return () => window.clearInterval(id);
  }, [open, status, trail, prefersReduced]);

  if (!open) return null;

  const displayed =
    trail[Math.min(index, Math.max(0, trail.length - 1))] ??
    reachedDateKey ??
    startDateKey;
  const parsed = displayed ? parseDateKey(displayed) : null;
  const done = status === "complete" || status === "error";
  const animDone =
    status === "animating" &&
    (prefersReduced || trail.length <= 1 || index >= trail.length - 1);

  const statusText =
    status === "processing"
      ? "Simulating match weeks…"
      : status === "error"
        ? statusMessage ?? "Simulation failed"
        : status === "complete" || animDone
          ? reachedDateKey
            ? `Reached ${formatDateKey(reachedDateKey)}`
            : "Simulation complete"
          : "Advancing calendar…";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="status"
      aria-live="polite"
      aria-modal="true"
    >
      <div
        className={`${CARD.elevated} w-full max-w-sm ${SPACING.cardPaddingSm} shadow-[0_12px_40px_rgba(0,0,0,0.45)]`}
      >
        <p className={TYPO.sectionLabel}>Sim to Date</p>

        {startDateKey ? (
          <p className={`mt-1 ${TYPO.meta} text-pitch-400`}>
            From {formatDateKey(startDateKey)}
          </p>
        ) : null}

        <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>{statusText}</p>

        <div className="mt-3 rounded-xl border border-theme-primary/25 bg-pitch-950/80 px-4 py-3 text-center">
          <p className="font-display text-[10px] font-bold uppercase tracking-wider text-theme-primary">
            {parsed ? MONTH_NAMES[parsed.m - 1] : "—"}
          </p>
          <p
            className={`mt-1 font-display text-4xl font-black tabular-nums text-white ${
              prefersReduced || status === "processing"
                ? ""
                : "transition-opacity duration-200"
            }`}
            key={displayed ?? "empty"}
          >
            {parsed?.d ?? "—"}
          </p>
          <p className={`mt-0.5 ${TYPO.meta}`}>{parsed?.y ?? ""}</p>
        </div>

        {reachedDateKey &&
        startDateKey &&
        reachedDateKey !== startDateKey &&
        (done || animDone) ? (
          <p className={`mt-2 text-center ${TYPO.meta} text-theme-primary`}>
            {formatDateKey(startDateKey)} → {formatDateKey(reachedDateKey)}
          </p>
        ) : null}

        {(done || animDone) && (
          <div className="mt-3 flex justify-center">
            <GameButton variant="theme" size="sm" onClick={onDismiss}>
              Continue
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
}
