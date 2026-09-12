"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import type { ManagerPlayer, Position, SquadTier } from "@/lib/manager/types";

export function ManagerSquadView() {
  const { state, movePlayer } = useManager();
  const [activeTier, setActiveTier] = useState<SquadTier | "unavailable">("first");
  const [selectedPlayer, setSelectedPlayer] = useState<ManagerPlayer | null>(null);
  const [posFilter, setPosFilter] = useState<string>("ALL");

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const allClubPlayers = Object.values(state.players).filter((p) => p.clubId === userClubId);

  // Filter by active tier
  let tierPlayers = allClubPlayers.filter((p) => {
    if (activeTier === "unavailable") {
      return p.injury !== null || p.suspension !== null;
    }
    return p.squadTier === activeTier;
  });

  if (posFilter !== "ALL") {
    tierPlayers = tierPlayers.filter((p) => p.position === posFilter);
  }

  // Sort by rating descending
  tierPlayers.sort((a, b) => b.rating - a.rating);

  const firstCount = allClubPlayers.filter((p) => p.squadTier === "first").length;
  const reservesCount = allClubPlayers.filter((p) => p.squadTier === "reserves").length;
  const academyCount = allClubPlayers.filter((p) => p.squadTier === "academy").length;
  const unavailableCount = allClubPlayers.filter((p) => p.injury || p.suspension).length;

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      {/* Header and Tier Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Squad Management</h2>
          <p className="text-xs text-pitch-400">
            Organise First Team, Reserves, and Academy tiers. Move developing prospects up the ranks.
          </p>
        </div>

        {/* Tier Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTier("first")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "first"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            First Team ({firstCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTier("reserves")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "reserves"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Reserves ({reservesCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTier("academy")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "academy"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Academy ({academyCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTier("unavailable")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTier === "unavailable"
                ? "bg-rose-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Unavailable ({unavailableCount})
          </button>
        </div>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
            <tr>
              <th className="py-3 px-3">Pos</th>
              <th className="py-3 px-3">Player</th>
              <th className="py-3 px-2 text-center">Age</th>
              <th className="py-3 px-2 text-center">OVR</th>
              <th className="py-3 px-2 text-center">Pot</th>
              <th className="py-3 px-2 text-center">Form</th>
              <th className="py-3 px-2 text-center">Morale</th>
              <th className="py-3 px-3 text-right">Wage</th>
              <th className="py-3 px-2 text-center">Expires</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
            {tierPlayers.length ? (
              tierPlayers.map((player) => {
                const isInjured = player.injury !== null;
                const isSuspended = player.suspension !== null;

                return (
                  <tr
                    key={player.id}
                    className="hover:bg-pitch-800/40 transition-colors"
                  >
                    {/* Position */}
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300 border border-pitch-700">
                        {player.position.slice(0, 2)}
                      </span>
                    </td>

                    {/* Name & Flags */}
                    <td className="py-2.5 px-3 font-medium text-white">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPlayer(player)}
                          className="hover:text-emerald-400 transition-colors text-left"
                        >
                          {player.name}
                        </button>
                        {isInjured && (
                          <span className="rounded bg-rose-500/20 px-1 text-[10px] font-bold text-rose-400 border border-rose-500/40">
                            INJ ({player.injury?.weeksRemaining}w)
                          </span>
                        )}
                        {isSuspended && (
                          <span className="rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-400 border border-amber-500/40">
                            SUSP ({player.suspension?.weeksRemaining}w)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Age */}
                    <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>

                    {/* Rating (OVR) */}
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`font-black text-sm ${
                          player.rating >= 85
                            ? "text-amber-400"
                            : player.rating >= 78
                            ? "text-emerald-400"
                            : "text-white"
                        }`}
                      >
                        {player.rating}
                      </span>
                    </td>

                    {/* Potential */}
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-pitch-300 font-bold">{player.potential}</span>
                    </td>

                    {/* Form */}
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`font-semibold ${
                          player.form >= 8.0
                            ? "text-emerald-400"
                            : player.form < 6.5
                            ? "text-rose-400"
                            : "text-pitch-300"
                        }`}
                      >
                        {player.form.toFixed(1)}
                      </span>
                    </td>

                    {/* Morale */}
                    <td className="py-2.5 px-2 text-center">
                      <div className="mx-auto h-1.5 w-10 rounded-full bg-pitch-950 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            player.morale >= 80
                              ? "bg-emerald-400"
                              : player.morale >= 60
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                          style={{ width: `${player.morale}%` }}
                        />
                      </div>
                    </td>

                    {/* Wage */}
                    <td className="py-2.5 px-3 text-right font-medium text-pitch-300">
                      £{player.contract?.wageWeekly.toLocaleString() || "0"}/wk
                    </td>

                    {/* Expiry */}
                    <td className="py-2.5 px-2 text-center text-pitch-400">
                      {player.contract?.expiresSeason || "-"}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {player.squadTier === "academy" && (
                          <button
                            type="button"
                            onClick={() => movePlayer(player.id, "reserves")}
                            className="rounded bg-pitch-800 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-950/60 border border-emerald-500/30 transition-all"
                          >
                            To Reserves
                          </button>
                        )}

                        {player.squadTier === "reserves" && (
                          <>
                            <button
                              type="button"
                              onClick={() => movePlayer(player.id, "first")}
                              className="rounded bg-emerald-600/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                            >
                              To First Team
                            </button>
                            {player.age <= 21 && (
                              <button
                                type="button"
                                onClick={() => movePlayer(player.id, "academy")}
                                className="rounded bg-pitch-800 px-2 py-1 text-[11px] font-semibold text-pitch-400 hover:text-white transition-all"
                              >
                                To Academy
                              </button>
                            )}
                          </>
                        )}

                        {player.squadTier === "first" && (
                          <button
                            type="button"
                            onClick={() => movePlayer(player.id, "reserves")}
                            className="rounded bg-pitch-800 px-2 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-950/60 border border-amber-500/30 transition-all"
                          >
                            To Reserves
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="py-8 text-center text-pitch-500 italic">
                  No players in this squad tier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-pitch-800">
              <div>
                <span className="rounded bg-pitch-800 px-2 py-0.5 text-xs font-bold text-pitch-300">
                  {selectedPlayer.position}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{selectedPlayer.name}</h3>
                <p className="text-xs text-pitch-400">
                  {selectedPlayer.age} yrs · {selectedPlayer.nationality} · Tier: {selectedPlayer.squadTier}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="text-pitch-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60">
                <span className="block text-pitch-400">Overall Rating</span>
                <span className="text-2xl font-black text-emerald-400">{selectedPlayer.rating}</span>
              </div>
              <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60">
                <span className="block text-pitch-400">Potential Ceiling</span>
                <span className="text-2xl font-black text-amber-400">{selectedPlayer.potential}</span>
              </div>
              <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60">
                <span className="block text-pitch-400">Weekly Wage</span>
                <span className="text-sm font-bold text-white">
                  £{selectedPlayer.contract?.wageWeekly.toLocaleString() || "0"}/wk
                </span>
              </div>
              <div className="rounded-xl bg-pitch-950/70 p-2.5 border border-pitch-800/60">
                <span className="block text-pitch-400">Contract End</span>
                <span className="text-sm font-bold text-white">
                  {selectedPlayer.contract?.expiresSeason || "Free Agent"}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-pitch-800 pt-3 mb-4">
              <div className="flex justify-between">
                <span className="text-pitch-400">Season Appearances:</span>
                <span className="font-semibold text-white">{selectedPlayer.stats.apps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pitch-400">Season Tries:</span>
                <span className="font-semibold text-white">{selectedPlayer.stats.tries}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pitch-400">Season Points:</span>
                <span className="font-semibold text-white">{selectedPlayer.stats.points}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pitch-400">Career Tries:</span>
                <span className="font-semibold text-white">{selectedPlayer.careerStats.tries}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedPlayer(null)}
              className="w-full rounded-xl bg-pitch-800 py-2.5 text-center text-xs font-bold text-white hover:bg-pitch-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
