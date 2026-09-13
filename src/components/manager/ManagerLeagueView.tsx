"use client";

import React, { useEffect, useState } from "react";
import { useManager } from "@/lib/manager/context";
import { sortStandings } from "@/lib/manager/competitions";
import type { CompetitionId } from "@/lib/manager/types";

export function ManagerLeagueView() {
  const { state } = useManager();
  const userComp =
    (state?.manager.clubId && state.clubs[state.manager.clubId]?.competitionId) ||
    "super-league";
  const [activeTier, setActiveTier] = useState<CompetitionId>(userComp);

  useEffect(() => {
    setActiveTier(userComp);
  }, [userComp]);

  if (!state) return null;

  const userClub = state.clubs[state.manager.clubId];
  const comp = state.competitions[activeTier];
  const sorted = comp ? sortStandings(comp.standings) : [];

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:py-6 sm:px-6 space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">League</h2>
          <p className="hidden sm:block text-xs text-pitch-400">
            Official league tables with promotion, playoff, and relegation cutoffs.
          </p>
        </div>

        {/* Division switch */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTier("super-league")}
            className={`flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              activeTier === "super-league"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Super League
          </button>
          <button
            type="button"
            onClick={() => setActiveTier("championship")}
            className={`flex-1 sm:flex-none rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              activeTier === "championship"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Championship
          </button>
        </div>
      </div>

      {/* Mobile compact standings */}
      <div className="sm:hidden rounded-2xl border border-pitch-800 bg-pitch-900/80 overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_2rem_2.5rem_2.5rem] gap-1 border-b border-pitch-800 bg-pitch-950/80 px-2.5 py-2 text-[10px] font-bold uppercase text-pitch-500">
          <span>#</span>
          <span>Club</span>
          <span className="text-center">P</span>
          <span className="text-center">Diff</span>
          <span className="text-center">Pts</span>
        </div>
        <ul className="divide-y divide-pitch-800/60">
          {sorted.map((row, idx) => {
            const rank = idx + 1;
            const club = state.clubs[row.clubId];
            const isUserClub = row.clubId === userClub?.id;
            const isSuperLeague = activeTier === "super-league";
            const zone =
              isSuperLeague && rank <= 6
                ? "border-l-emerald-500"
                : isSuperLeague && rank === 13
                  ? "border-l-amber-500"
                  : isSuperLeague && rank === 14
                    ? "border-l-rose-500"
                    : !isSuperLeague && rank === 1
                      ? "border-l-amber-400"
                      : !isSuperLeague && rank <= 6
                        ? "border-l-emerald-500"
                        : "border-l-transparent";

            return (
              <li
                key={row.clubId}
                className={`grid grid-cols-[2rem_1fr_2rem_2.5rem_2.5rem] gap-1 items-center px-2.5 py-2.5 border-l-2 ${zone} ${
                  isUserClub ? "bg-emerald-500/10" : ""
                }`}
              >
                <span className="text-xs font-black text-pitch-300">{rank}</span>
                <span className={`truncate text-sm font-semibold ${isUserClub ? "text-emerald-300" : "text-white"}`}>
                  {club?.abbreviation || club?.name || row.clubId}
                </span>
                <span className="text-center text-xs text-pitch-400">{row.played}</span>
                <span
                  className={`text-center text-xs font-semibold ${
                    row.pointsDifference >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {row.pointsDifference > 0 ? `+${row.pointsDifference}` : row.pointsDifference}
                </span>
                <span className="text-center text-sm font-black text-sky-400">{row.points}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop Standings Table */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
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
              const isMpgSL = isSuperLeague && rank === 13;
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
                        isPromotionChamp || (isSuperLeague && rank === 1)
                          ? "bg-amber-500 text-slate-950 font-black shadow"
                          : isPlayoffsSL || isPlayoffsChamp
                          ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                          : isMpgSL
                          ? "bg-amber-600/30 text-amber-300 border border-amber-500/50"
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
      <div className="hidden sm:flex flex-wrap items-center gap-4 text-xs text-pitch-400 pt-1">
        {activeTier === "super-league" ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500/40 border border-emerald-500" />
              <span>Super League Top 6 (Playoffs)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500/40 border border-amber-500" />
              <span>13th Place (The Million Pound Game)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-rose-500/40 border border-rose-500" />
              <span>14th Place (Automatic Relegation to Championship)</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500" />
              <span>1st Place (Champions &amp; Automatic Promotion to Super League)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500/40 border border-emerald-500" />
              <span>2nd - 6th Place (Championship Playoffs for Million Pound Game)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
