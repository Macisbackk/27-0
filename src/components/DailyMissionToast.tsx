"use client";

import { useEffect, useState } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { formatClubFunds } from "@/lib/club-funds";
import {
  DAILY_MISSIONS_CHANGED_EVENT,
  type DailyMissionsChangedDetail,
} from "@/lib/daily-missions";
import { uiLayerClass } from "@/lib/ui/layers";

interface ToastLine {
  key: number;
  text: string;
  amount: number;
}

const SHOW_MS = 4_500;

/**
 * One-line "Mission complete" toast(s) for Daily Missions paid outside a ClubFundsEarned popup
 * (e.g. puzzles). Mount where runs end; it only listens for reportMissionEvent payouts.
 */
export function DailyMissionToast() {
  const [lines, setLines] = useState<ToastLine[]>([]);

  useEffect(() => {
    let seq = 0;
    const timers: number[] = [];
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<DailyMissionsChangedDetail>).detail;
      if (!detail) return;
      const next: ToastLine[] = detail.completed.map((m) => ({
        key: ++seq,
        text: `Mission complete: ${m.title}`,
        amount: m.reward,
      }));
      if (detail.bonus > 0) {
        next.push({ key: ++seq, text: "All three daily missions done", amount: detail.bonus });
      }
      if (next.length === 0) return;
      setLines((prev) => [...prev, ...next]);
      const keys = new Set(next.map((l) => l.key));
      timers.push(
        window.setTimeout(() => setLines((prev) => prev.filter((l) => !keys.has(l.key))), SHOW_MS)
      );
    };
    window.addEventListener(DAILY_MISSIONS_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(DAILY_MISSIONS_CHANGED_EVENT, onChange);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (lines.length === 0) return null;
  return (
    <BodyPortal>
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 top-3 flex flex-col items-center gap-2 px-4 ${uiLayerClass("criticalAnimation")}`}
      >
        {lines.map((line) => (
          <div
            key={line.key}
            className="flex max-w-md items-center gap-3 rounded-control border border-theme-primary/60 bg-pitch-800 px-3 py-2 text-sm text-[color:var(--fl-text)] shadow-lg"
          >
            <span className="min-w-0">{line.text}</span>
            <span className="shrink-0 font-bold tabular-nums text-theme-primary">
              +{formatClubFunds(line.amount)}
            </span>
          </div>
        ))}
      </div>
    </BodyPortal>
  );
}
