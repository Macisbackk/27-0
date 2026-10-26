"use client";

import { useEffect, useState } from "react";
import { GamePanel } from "@/components/ui/GamePanel";
import { formatClubFunds } from "@/lib/club-funds";
import { formatCountdown, msUntilUkMidnight } from "@/lib/daily-bonus";
import {
  DAILY_MISSIONS_CHANGED_EVENT,
  getDailyMissionsView,
  type DailyMissionsView,
} from "@/lib/daily-missions";
import { CLUB_FUNDS_CHANGED_EVENT } from "@/lib/storage/club-funds";
import { TYPO } from "@/lib/ui/typography";

function Tick({ done }: { done: boolean }) {
  return (
    <>
    <span className="sr-only">{done ? "Done:" : "To do:"}</span>
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold ${
        done
          ? "border-theme-primary bg-theme-primary text-black"
          : "border-[color:var(--fl-muted)] text-transparent"
      }`}
    >
      ✓
    </span>
    </>
  );
}

/**
 * "Today's missions": three goals for the UK day with progress and reward, plus the bonus for
 * clearing all three. Reads local progress + the Club Funds ledger, so it renders after mount.
 */
export function DailyMissionsCard({ className = "" }: { className?: string }) {
  const [view, setView] = useState<DailyMissionsView | null>(null);
  const [resetIn, setResetIn] = useState<string>("");

  useEffect(() => {
    const refresh = () => {
      setView(getDailyMissionsView());
      setResetIn(formatCountdown(msUntilUkMidnight()));
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(DAILY_MISSIONS_CHANGED_EVENT, refresh);
    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(DAILY_MISSIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!view) return null;
  const doneCount = view.missions.filter((m) => m.complete).length;

  return (
    <GamePanel
      as="section"
      variant="elevated"
      className={`p-3 sm:p-4 ${className}`.trim()}
      aria-label="Today's missions"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 className={TYPO.cardHeading}>Today&apos;s missions</h3>
        <span className={TYPO.label}>
          {doneCount}/{view.missions.length}
          {resetIn ? ` · resets in ${resetIn}` : ""}
        </span>
      </header>
      <ul className="mt-3 space-y-1.5">
        {view.missions.map((mission) => (
          <li
            key={mission.id}
            className="flex items-center gap-3 rounded-control bg-pitch-800 px-3 py-2.5 text-sm text-[color:var(--fl-text)]"
          >
            <Tick done={mission.complete} />
            <span className={`min-w-0 flex-1 ${mission.complete ? "opacity-70" : ""}`}>
              {mission.title}
              {!mission.complete && mission.target > 1 ? (
                <span className="ml-1.5 tabular-nums text-[color:var(--fl-muted)]">
                  {mission.progress}/{mission.target}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-theme-primary">
              +{formatClubFunds(mission.reward)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-3 px-3 py-1.5 text-sm">
        <Tick done={view.bonus.paid} />
        <span className={`min-w-0 flex-1 ${TYPO.label}`}>All three done</span>
        <span className="shrink-0 font-bold tabular-nums text-theme-primary">
          +{formatClubFunds(view.bonus.amount)}
        </span>
      </div>
    </GamePanel>
  );
}
