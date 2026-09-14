"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import type { CompetitionId, ManagerFixture } from "@/lib/manager/types";

export function ManagerFixturesView() {
  const { state, setLastPlayedMatchReview, openKeyMoments } = useManager();
  const userClubId = state?.manager.clubId;
  const userComp =
    (userClubId && state?.clubs[userClubId]?.competitionId) || "super-league";
  const [selectedCompId, setSelectedCompId] = useState<CompetitionId>(userComp);

  if (!state) return null;

  const userClub = state.clubs[state.manager.clubId];
  const comp = state.competitions[selectedCompId];
  const fixtures = comp ? comp.fixtures : [];

  // Group fixtures by week/round
  const groupedByWeek = new Map<number, ManagerFixture[]>();
  fixtures.forEach((f) => {
    const list = groupedByWeek.get(f.week) || [];
    list.push(f);
    groupedByWeek.set(f.week, list);
  });

  const sortedWeeks = Array.from(groupedByWeek.keys()).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">Fixtures</h2>
          <p className="hidden sm:block text-xs text-pitch-400">
            Official league schedule, Challenge Cup ties, and match scores.
          </p>
        </div>

        {/* Competition filter buttons */}
        <div className="grid grid-cols-3 gap-1 sm:flex sm:items-center sm:justify-end sm:gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCompId(userClub?.competitionId || "super-league")}
            className={`rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition-all ${
              selectedCompId === userClub?.competitionId
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            <span className="sm:hidden">League</span>
            <span className="hidden sm:inline">
              My League ({userClub?.competitionId === "super-league" ? "Super League" : "Championship"})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompId("challenge-cup")}
            className={`rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition-all ${
              selectedCompId === "challenge-cup"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            <span className="sm:hidden">Cup</span>
            <span className="hidden sm:inline">Challenge Cup</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompId("friendlies")}
            className={`rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition-all ${
              selectedCompId === "friendlies"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            <span className="sm:hidden">Friendly</span>
            <span className="hidden sm:inline">Friendlies</span>
          </button>
        </div>
      </div>

      {/* Fixtures Timeline */}
      <div className="space-y-6">
        {sortedWeeks.map((week) => {
          const weekFixtures = groupedByWeek.get(week) || [];
          const isCurrentWeek = week === state.calendar.currentWeek;

          return (
            <div key={week} className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-pitch-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {weekFixtures[0]?.roundName || `Week ${week}`}
                  </span>
                  {isCurrentWeek && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 uppercase">
                      Current Week
                    </span>
                  )}
                </div>
                <span className="text-xs text-pitch-400">Week {week}</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {weekFixtures.map((fixture) => {
                  const homeClub = state.clubs[fixture.homeClubId];
                  const awayClub = state.clubs[fixture.awayClubId];
                  const isUserMatch =
                    fixture.homeClubId === userClub?.id || fixture.awayClubId === userClub?.id;

                  return (
                    <div
                      key={fixture.id}
                      onClick={() => {
                        if (fixture.isPlayed) {
                          setLastPlayedMatchReview(fixture);
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        fixture.isPlayed
                          ? "cursor-pointer hover:border-emerald-500/60"
                          : "opacity-80"
                      } ${
                        isUserMatch
                          ? "border-emerald-500/40 bg-pitch-800/80 ring-1 ring-emerald-500/20"
                          : "border-pitch-800 bg-pitch-950/60"
                      }`}
                    >
                      {/* Home */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-bold text-white truncate text-right flex-1">
                          {homeClub?.name || fixture.homeClubId}
                        </span>
                      </div>

                      {/* Score or VS */}
                      <div className="mx-2 sm:mx-3 flex items-center justify-center shrink-0">
                        {fixture.isPlayed ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-lg bg-pitch-900 px-2.5 py-1 text-xs font-black text-emerald-400 border border-pitch-700 shadow-sm">
                              {fixture.homeScore} - {fixture.awayScore}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openKeyMoments(fixture);
                              }}
                              className="hidden sm:inline-flex rounded-lg bg-pitch-800/90 hover:bg-emerald-600 px-1.5 py-1 text-[10px] font-bold text-pitch-300 hover:text-white border border-pitch-700 transition-colors"
                              title="Watch Key Moments"
                            >
                              ⚡ Moments
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-pitch-500 uppercase">
                            vs
                          </span>
                        )}
                      </div>

                      {/* Away */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-bold text-white truncate flex-1">
                          {awayClub?.name || fixture.awayClubId}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
