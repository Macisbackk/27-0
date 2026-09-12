"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import { calculateSalaryCapUsage, formatCalendarPhase } from "@/lib/manager";
import { TYPO } from "@/lib/ui/typography";
import { BTN } from "@/lib/ui/design-system";

export function ManagerHeader() {
  const { state, isAdvancing, advanceCurrentWeek, rolloverCurrentSeason, setActiveTab } = useManager();

  if (!state) return null;

  const club = state.clubs[state.manager.clubId];
  const cap = calculateSalaryCapUsage(state, club?.id || "");
  const unreadCount = state.inbox.unreadCount;
  const isSeasonEnded = state.calendar.phase === "season_end";

  return (
    <header className="sticky top-0 z-30 border-b border-pitch-700 bg-pitch-950/95 backdrop-blur-md px-3 py-2.5 sm:px-6 sm:py-3 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: Club Identity & Season Context */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-md text-sm border border-white/20"
            style={{
              backgroundColor: club?.primaryColor || "#1E4D9B",
              color: club?.textColour || "#FFFFFF",
            }}
          >
            {club?.abbreviation || "RL"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold text-white sm:text-lg">
                {club?.name || "My Club"}
              </h1>
              <span className="shrink-0 rounded-full bg-pitch-800 px-2 py-0.5 text-xs font-semibold uppercase text-pitch-300 border border-pitch-600">
                {club?.competitionId === "super-league" ? "Super League" : "Championship"}
              </span>
            </div>
            <p className="truncate text-xs text-pitch-400">
              Season {state.calendar.currentSeason} · Week {state.calendar.currentWeek} of {state.calendar.totalWeeks}
              <span className="hidden sm:inline"> ({formatCalendarPhase(state.calendar.phase)})</span>
            </p>
          </div>
        </div>

        {/* Center: Financial & Cap Headroom (desktop) */}
        <div className="hidden lg:flex items-center gap-6 text-xs">
          <div className="rounded-lg bg-pitch-900/80 px-3 py-1.5 border border-pitch-800">
            <span className="text-pitch-400">Balance: </span>
            <span className="font-bold text-emerald-400">
              £{club?.finances.balance.toLocaleString()}
            </span>
          </div>
          <div className="rounded-lg bg-pitch-900/80 px-3 py-1.5 border border-pitch-800">
            <span className="text-pitch-400">Salary Cap Room: </span>
            <span className={`font-bold ${cap.isOverCap ? "text-rose-400" : "text-sky-400"}`}>
              £{Math.max(0, cap.availableCapWeekly).toLocaleString()}/wk
            </span>
          </div>
        </div>

        {/* Right: Inbox Pill & Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-pitch-700 bg-pitch-900 hover:bg-pitch-800 text-pitch-300 transition-colors"
            title="Manager Inbox"
            aria-label="Manager Inbox"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
                {unreadCount}
              </span>
            )}
          </button>

          {isSeasonEnded ? (
            <button
              type="button"
              onClick={() => rolloverCurrentSeason()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all text-sm"
            >
              <span>Next Season</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              disabled={isAdvancing}
              onClick={() => advanceCurrentWeek()}
              className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all text-sm ${
                isAdvancing ? "opacity-75 cursor-wait" : ""
              }`}
            >
              {isAdvancing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
