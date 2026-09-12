"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { sortStandings } from "@/lib/manager/competitions";
import type { CompetitionId } from "@/lib/manager/types";

export function ManagerLeagueView() {
  const { state } = useManager();
  const [activeTier, setActiveTier] = useState<CompetitionId>("super-league");

  if (!state) return null;

  const userClub = state.clubs[state.manager.clubId];
  const comp = state.competitions[activeTier];
  const sorted = comp ? sortStandings(comp.standings) : [];

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">League Standings</h2>
          <p className="text-xs text-pitch-400">
            Official league tables with promotion, playoff, and relegation cutoffs.
          </p>
        </div>

        {/* Division switch */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTier("super-league")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTier === "super-league"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Super League (14 Clubs)
          </button>
          <button
            type="button"
            onClick={() => setActiveTier("championship")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTier === "championship"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Championship (12 Clubs)
          </button>
        </div>
      </div>

      {/* Standings Table */}
      <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
            <tr>
              <th className="py-3 px-3 text-center">Pos</th>
              <th className="py-3 px-3">Club</th>
              <th className="py-3 px-2 text-center">P</th>
              <th className="py-3 px-2 text-center">W</th>
              <th className="py-3 px-2 text-center">D</th>
              <th className="py-3 px-2 text-center">L</th>
              <th className="py-3 px-2 text-center">PF</th>
              <th className="py-3 px-2 text-center">PA</th>
              <th className="py-3 px-2 text-center">Diff</th>
              <th className="py-3 px-3 text-center">Pts</th>
              <th className="py-3 px-3 text-center">Form</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
            {sorted.map((row, idx) => {
              const rank = idx + 1;
              const club = state.clubs[row.clubId];
              const isUserClub = row.clubId === userClub?.id;

              // Zones
              const isSuperLeague = activeTier === "super-league";
              const isPlayoffsSL = isSuperLeague && rank <= 6;
              const isRelegationSL = isSuperLeague && rank === 14;

              const isPromotionChamp = !isSuperLeague && rank === 1;
              const isPlayoffsChamp = !isSuperLeague && rank >= 2 && rank <= 6;

              return (
                <tr
                  key={row.clubId}
                  className={`transition-colors ${
                    isUserClub
                      ? "bg-emerald-500/15 font-bold text-white hover:bg-emerald-500/20"
                      : "hover:bg-pitch-800/40"
                  }`}
                >
                  {/* Pos with zone border */}
                  <td className="py-2.5 px-3 text-center font-bold">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs ${
                        isPromotionChamp || rank === 1
                          ? "bg-amber-500 text-slate-950 font-black shadow"
                          : isPlayoffsSL || isPlayoffsChamp
                          ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                          : isRelegationSL
                          ? "bg-rose-600/30 text-rose-300 border border-rose-500/40"
                          : "text-pitch-400"
                      }`}
                    >
                      {rank}
                    </span>
                  </td>

                  {/* Club */}
                  <td className="py-2.5 px-3 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: club?.primaryColor || "#fff" }}
                      />
                      <span>{club?.name || row.clubId}</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-2 text-center text-pitch-400">{row.played}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-300">{row.won}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{row.drawn}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{row.lost}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{row.pointsFor}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{row.pointsAgainst}</td>
                  <td
                    className={`py-2.5 px-2 text-center font-semibold ${
                      row.pointsDifference >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {row.pointsDifference > 0 ? `+${row.pointsDifference}` : row.pointsDifference}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black text-sm text-sky-400">
                    {row.points}
                  </td>

                  {/* Form */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {row.form.length ? (
                        row.form.map((res, i) => (
                          <span
                            key={i}
                            className={`flex h-4 w-4 items-center justify-center rounded font-bold text-[9px] text-white ${
                              res === "W" ? "bg-emerald-600" : (res === "D" ? "bg-amber-600" : "bg-rose-600")
                            }`}
                          >
                            {res}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-pitch-500 italic">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-pitch-400 pt-1">
        {activeTier === "super-league" ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500/40 border border-emerald-500" />
              <span>Super League Top 6 (Playoffs)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-rose-500/40 border border-rose-500" />
              <span>14th Place (Relegation to Championship)</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500" />
              <span>1st Place (Automatic Promotion to Super League)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500/40 border border-emerald-500" />
              <span>2nd - 6th Place (Championship Playoffs)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
