"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import { calculateSeasonAwards } from "@/lib/manager/rollover";
import { StickyActionBar } from "@/components/ui/MobileLayout";

/**
 * Mobile-only Continue / Review Season bar. Always mounted; hidden on desktop via StickyActionBar.
 */
export function ManagerMobilePlayBar() {
  const {
    state,
    isAdvancing,
    advanceCurrentWeek,
    lastAdvanceError,
    clearAdvanceError,
    getUserMatchdayReadiness,
    setSeasonAwardsModal,
    setActiveTab,
    autoPickSquad,
  } = useManager();

  if (!state) return null;

  const isSeasonEnded = state.calendar.phase === "season_end";
  const readiness = getUserMatchdayReadiness();
  const lineupShort = readiness != null && !readiness.ready;

  return (
    <StickyActionBar aboveNav portal className="manager-mobile-play-bar z-40">
      <div className="flex w-full flex-col gap-2">
        {lastAdvanceError ? (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-2 text-[11px] text-amber-100">
            <p className="leading-snug line-clamp-2">{lastAdvanceError}</p>
            <button
              type="button"
              onClick={() => {
                autoPickSquad();
                clearAdvanceError();
              }}
              className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2 py-1 font-bold text-amber-200"
            >
              Fill
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (lineupShort) autoPickSquad();
              else setActiveTab("tactics");
            }}
            className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-bold ${
              lineupShort
                ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                : "border-pitch-700 bg-pitch-900 text-pitch-200"
            }`}
          >
            {lineupShort ? `${readiness?.selectedCount ?? 0}/17` : "17"}
          </button>

          {isSeasonEnded ? (
            <button
              type="button"
              onClick={() => setSeasonAwardsModal(calculateSeasonAwards(state))}
              className="min-h-11 flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-sm font-black text-slate-950"
            >
              Review Season
            </button>
          ) : (
            <button
              type="button"
              disabled={isAdvancing}
              onClick={() => advanceCurrentWeek()}
              className={`min-h-11 flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-sm font-black text-slate-950 ${
                isAdvancing ? "opacity-75" : ""
              }`}
            >
              {isAdvancing ? "Simulating…" : "Continue"}
            </button>
          )}
        </div>
      </div>
    </StickyActionBar>
  );
}
