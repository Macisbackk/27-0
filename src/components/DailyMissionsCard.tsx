"use client";

import { useEffect, useState } from "react";
import { formatClubFunds } from "@/lib/club-funds";
import {
  DAILY_MISSIONS_CHANGED_EVENT,
  getDailyMissionsView,
  type DailyMissionsView,
} from "@/lib/daily-missions";
import { CLUB_FUNDS_CHANGED_EVENT } from "@/lib/storage/club-funds";

/** Today's three missions (local progress + the Club Funds ledger), live after mount. */
export function useDailyMissions(): DailyMissionsView | null {
  const [view, setView] = useState<DailyMissionsView | null>(null);
  useEffect(() => {
    const refresh = () => {
      try {
        setView(getDailyMissionsView());
      } catch {
        setView(null);
      }
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
  return view;
}

/** Club Funds still on offer today: unpaid missions plus the all-three bonus. */
export function missionsLeftToEarn(view: DailyMissionsView): number {
  const missions = view.missions.filter((m) => !m.paid).reduce((sum, m) => sum + m.reward, 0);
  return missions + (view.bonus.paid ? 0 : view.bonus.amount);
}

/** Three arcs round a count: one arc per mission, lit when done. */
export function MissionsRing({ view, size = 44 }: { view: DailyMissionsView; size?: number }) {
  const n = view.missions.length || 3;
  const done = view.missions.filter((m) => m.complete).length;
  const r = 15;
  const c = 2 * Math.PI * r;
  const gap = 5;
  const seg = c / n - gap;
  return (
    <span aria-hidden className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 40 40" className="-rotate-90">
        {Array.from({ length: n }, (_, i) => (
          <circle
            key={i}
            cx="20"
            cy="20"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${seg} ${c - seg}`}
            strokeDashoffset={-(i * (seg + gap)) - gap / 2}
            className={view.missions[i]?.complete ? "stroke-theme-primary" : "stroke-pitch-600"}
          />
        ))}
      </svg>
      <span className="absolute font-display text-[15px] leading-none text-white">
        {done}
        <span className="text-[color:var(--fl-muted)]">/{n}</span>
      </span>
    </span>
  );
}

/** The opened list: each mission with progress and reward, plus the all-three bonus. */
export function MissionsList({ view, id, resetIn }: { view: DailyMissionsView; id?: string; resetIn?: string | null }) {
  return (
    <section id={id} aria-label="Today's missions" className="rounded-card bg-pitch-900 p-2 text-left">
      <ul className="space-y-1">
        {view.missions.map((mission) => (
          <li key={mission.id} className="flex items-center gap-3 rounded-control px-2.5 py-2 text-[14px]">
            <Tick done={mission.complete} />
            <span className={`min-w-0 flex-1 leading-snug ${mission.complete ? "text-[color:var(--fl-muted)] line-through decoration-white/30" : "text-white"}`}>
              {mission.title}
              {!mission.complete && mission.target > 1 ? (
                <span className="ml-1.5 tabular-nums text-[color:var(--fl-muted)]">
                  {mission.progress}/{mission.target}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-cond text-[15px] font-bold tabular-nums text-theme-primary">
              +{formatClubFunds(mission.reward)}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-control bg-pitch-800 px-2.5 py-2 text-[14px]">
          <Tick done={view.bonus.paid} />
          <span className="min-w-0 flex-1 font-semibold text-white">All three</span>
          {resetIn ? <span className="shrink-0 text-[12px] text-[color:var(--fl-muted)]">{resetIn} left</span> : null}
          <span className="shrink-0 font-cond text-[15px] font-bold tabular-nums text-theme-primary">
            +{formatClubFunds(view.bonus.amount)}
          </span>
        </li>
      </ul>
    </section>
  );
}

function Tick({ done }: { done: boolean }) {
  return (
    <>
      <span className="sr-only">{done ? "Done:" : "To do:"}</span>
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black ${
          done ? "border-theme-primary bg-theme-primary text-[color:var(--theme-text-on-primary)]" : "border-pitch-600 text-transparent"
        }`}
      >
        ✓
      </span>
    </>
  );
}
