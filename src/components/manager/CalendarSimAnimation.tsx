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
  /** Fired once the date-count animation reaches the final date. */
  onTrailComplete?: () => void;
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

function toDateKey(utcMs: number): string {
  const dt = new Date(utcMs);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Count from the current game date to the reached date.
 * Short spans: every day. Longer spans: evenly spaced steps so the counter still
 * reads as a continuous advance without a multi-minute animation.
 */
export function buildDateTrail(start: string, end: string): string[] {
  if (start === end) return [end];
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  if (!a || !b) return [start, end];

  const startUtc = Date.UTC(a.y, a.m - 1, a.d);
  const endUtc = Date.UTC(b.y, b.m - 1, b.d);
  const dayMs = 86_400_000;
  const days = Math.max(0, Math.round((endUtc - startUtc) / dayMs));
  if (days <= 0) return [end];

  // Cap frames so UI stays snappy (~1.5–2.5s at adaptive interval).
  const maxFrames = 24;
  const stepDays = days <= maxFrames ? 1 : Math.ceil(days / maxFrames);

  const trail: string[] = [start];
  for (let day = stepDays; day < days; day += stepDays) {
    trail.push(toDateKey(startUtc + day * dayMs));
  }
  if (trail[trail.length - 1] !== end) trail.push(end);
  return trail;
}

/**
 * Compact calendar progression for Sim to Date — presentation only.
 * Counts from the current game date to the real reached date.
 * Centred viewport overlay; scroll locked while open.
 */
export function CalendarSimAnimation({
  open,
  startDateKey,
  reachedDateKey,
  status,
  statusMessage,
  onDismiss,
  onTrailComplete,
}: CalendarSimAnimationProps) {
  const scrollLockIdRef = useRef<ScrollLockId | null>(null);
  const completedRef = useRef(false);
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
    completedRef.current = false;
    if (!open || status !== "animating" || trail.length === 0) {
      setIndex(0);
      return;
    }
    if (prefersReduced || trail.length <= 1) {
      setIndex(trail.length - 1);
      if (!completedRef.current) {
        completedRef.current = true;
        onTrailComplete?.();
      }
      return;
    }

    setIndex(0);
    // Keep total count duration roughly 1.6–2.4s regardless of span length.
    const intervalMs = Math.max(
      45,
      Math.min(160, Math.round(2000 / Math.max(1, trail.length - 1)))
    );
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= trail.length) {
        window.clearInterval(id);
        setIndex(trail.length - 1);
        if (!completedRef.current) {
          completedRef.current = true;
          onTrailComplete?.();
        }
        return;
      }
      setIndex(i);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [open, status, trail, prefersReduced, onTrailComplete]);

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
  const progress =
    trail.length > 1 ? Math.min(1, index / (trail.length - 1)) : 1;

  const statusText =
    status === "processing"
      ? "Simulating match weeks…"
      : status === "error"
        ? statusMessage ?? "Simulation failed"
        : status === "complete" || animDone
          ? reachedDateKey
            ? `Reached ${formatDateKey(reachedDateKey)}`
            : "Simulation complete"
          : startDateKey && reachedDateKey
            ? `Counting ${formatDateKey(startDateKey)} → ${formatDateKey(reachedDateKey)}`
            : "Advancing calendar…";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4"
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
            {reachedDateKey ? ` · to ${formatDateKey(reachedDateKey)}` : ""}
          </p>
        ) : null}

        <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>{statusText}</p>

        <div className="mt-3 rounded-xl border border-theme-primary/25 bg-pitch-950/80 px-4 py-3 text-center">
          <p className="font-display text-[10px] font-bold uppercase tracking-wider text-theme-primary">
            {parsed ? MONTH_NAMES[parsed.m - 1] : "—"}
          </p>
          <p
            className="mt-1 font-display text-4xl font-black tabular-nums text-white"
            key={displayed ?? "empty"}
          >
            {parsed?.d ?? "—"}
          </p>
          <p className={`mt-0.5 ${TYPO.meta}`}>{parsed?.y ?? ""}</p>
        </div>

        {status === "animating" && trail.length > 1 ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pitch-800">
            <div
              className="h-full rounded-full bg-theme-primary transition-[width] duration-75"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
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
