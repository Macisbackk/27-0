"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { STARTING_POSITIONS } from "@/lib/manager/rules";
import { formatPositionLabel, formatPositionShort } from "@/lib/manager";
import {
  getPlayerGoalKicking,
  isEligibleGoalKickerPosition,
  pickBestGoalKicker,
} from "@/lib/manager/goal-kicking";
import type { ClubLineup, ClubTactics, Position } from "@/lib/manager/types";

export function ManagerTacticsView() {
  const {
    state,
    autoPickSquad,
    saveLineup,
    getUserMatchdayReadiness,
    clearAdvanceError,
    updateClubTactics,
  } = useManager();
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [isBenchSlot, setIsBenchSlot] = useState<boolean>(false);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  if (!club) return null;

  const lineup = club.lineup;
  const readiness = getUserMatchdayReadiness();
  const lineupShort = readiness != null && !readiness.ready;

  const isSlotEligible = (playerId: string | null) => {
    if (!playerId) return false;
    const p = state.players[playerId];
    if (!p) return false;
    return (
      !p.injury &&
      !p.suspension &&
      (p.clubId === userClubId || p.loan?.destinationClubId === userClubId)
    );
  };

  // Available players for selection (first team players who are not injured/suspended, or players on loan to this club)
  const availablePlayers = Object.values(state.players).filter(
    (p) =>
      ((p.clubId === userClubId && p.squadTier === "first" && !p.loan) ||
        (p.loan && p.loan.destinationClubId === userClubId)) &&
      !p.injury &&
      !p.suspension
  );

  const currentlySelectedIds = new Set([
    ...lineup.starting13.filter(Boolean),
    ...lineup.bench.filter(Boolean),
  ]);

  const handleSelectPlayerForSlot = (playerId: string | null) => {
    if (selectedSlotIdx === null) return;

    if (isBenchSlot) {
      const newBench = [...lineup.bench];
      newBench[selectedSlotIdx] = playerId;
      saveLineup({ ...lineup, bench: newBench });
    } else {
      const newStarting = [...lineup.starting13];
      newStarting[selectedSlotIdx] = playerId;
      saveLineup({ ...lineup, starting13: newStarting });
    }

    clearAdvanceError();
    setSelectedSlotIdx(null);
  };

  const kickerCandidates = availablePlayers
    .filter((p) => isEligibleGoalKickerPosition(p.position))
    .sort((a, b) => {
      const gk = getPlayerGoalKicking(b) - getPlayerGoalKicking(a);
      if (gk !== 0) return gk;
      return b.rating - a.rating;
    });
  const recommendedKicker = pickBestGoalKicker(availablePlayers);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-5">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-white">Tactics</h2>
          <p className="hidden sm:block text-xs text-pitch-400">
            Select your starting 13 and 4 interchange substitutes. Tune team playstyle and intensity.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={`rounded-xl border px-3 py-2 text-xs font-black ${
              lineupShort
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {readiness?.selectedCount ?? 0}/17 named
          </span>
          <button
            type="button"
            onClick={() => {
              autoPickSquad();
              clearAdvanceError();
            }}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all"
          >
            Auto Pick Optimal 17
          </button>
        </div>
      </div>

      {lineupShort && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 leading-relaxed">
          <span className="font-black text-amber-300">Matchday rule: </span>
          {readiness?.error ||
            "You need a full 17 (13 starters + 4 interchange) before playing a match week. Empty or unavailable slots are highlighted below."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Starting 13 Pitch View */}
        <div className="lg:col-span-8 rounded-2xl border border-pitch-700 bg-gradient-to-b from-pitch-900 via-pitch-950 to-pitch-900 p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-pitch-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Starting 13</h3>
            <span className="text-xs text-pitch-400">Tap any position slot to swap player</span>
          </div>

          {/* Roster Slots List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STARTING_POSITIONS.map((pos, slotIdx) => {
              const playerId = lineup.starting13[slotIdx];
              const player = playerId ? state.players[playerId] : null;
              const eligible = isSlotEligible(playerId);
              const slotProblem = !playerId || !eligible;

              return (
                <div
                  key={slotIdx}
                  onClick={() => {
                    setSelectedSlotIdx(slotIdx);
                    setIsBenchSlot(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    eligible
                      ? "border-pitch-700/80 bg-pitch-900/60 hover:bg-pitch-800/60"
                      : slotProblem
                        ? "border-dashed border-amber-500/50 bg-amber-500/10 hover:border-amber-400"
                        : "border-dashed border-pitch-700 bg-pitch-950/40 hover:border-emerald-500"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pitch-800 text-xs font-black text-white shrink-0">
                      {slotIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold text-pitch-400 uppercase tracking-wider">
                        {formatPositionLabel(pos)}
                      </span>
                      <span
                        className={`block text-xs font-bold truncate ${
                          eligible ? "text-white" : "text-amber-200"
                        }`}
                      >
                        {player
                          ? eligible
                            ? player.name
                            : `${player.name} (unavailable)`
                          : "Empty Slot"}
                      </span>
                    </div>
                  </div>

                  {eligible && player ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-emerald-400">{player.rating}</span>
                      <span className="text-[10px] text-pitch-400">OVR</span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-300 font-bold">+ Pick</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interchange Bench (4 Slots) */}
          <div className="mt-5 pt-4 border-t border-pitch-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2.5">
              Interchange Bench (14 - 17)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((benchIdx) => {
                const playerId = lineup.bench[benchIdx];
                const player = playerId ? state.players[playerId] : null;
                const eligible = isSlotEligible(playerId);

                return (
                  <div
                    key={benchIdx}
                    onClick={() => {
                      setSelectedSlotIdx(benchIdx);
                      setIsBenchSlot(true);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border cursor-pointer text-center transition-all ${
                      eligible
                        ? "border-pitch-700/80 bg-pitch-900/60 hover:bg-pitch-800/60"
                        : "border-dashed border-amber-500/50 bg-amber-500/10 hover:border-amber-400"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-pitch-400">#{14 + benchIdx}</span>
                    <span
                      className={`text-xs font-bold truncate w-full mt-0.5 ${
                        eligible ? "text-white" : "text-amber-200"
                      }`}
                    >
                      {player
                        ? eligible
                          ? player.name
                          : `${player.name} (out)`
                        : "+ Select"}
                    </span>
                    {eligible && player && (
                      <span className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                        {formatPositionShort(player.position)} · {player.rating}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Tactics Settings */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-pitch-800">
              Tactical Instructions
            </h3>

            {/* Playing Style */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-pitch-300 mb-1.5">
                Attacking Style
              </label>
              <select
                value={club.tactics.style}
                onChange={(e) =>
                  updateClubTactics({
                    style: e.target.value as ClubTactics["style"],
                  })
                }
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="balanced">Balanced (Structured & Patient)</option>
                <option value="expansive">Expansive (Open Tempo & High Risk)</option>
                <option value="attritional">Attritional (Arm-wrestle & Power)</option>
                <option value="direct">Direct (Hit the Ad-Line)</option>
              </select>
              <p className="mt-1 text-[10px] text-pitch-500">
                Affects match tempo and scoreline shape.
              </p>
            </div>

            {/* Kicking Focus */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-pitch-300 mb-1.5">
                Kicking Philosophy
              </label>
              <select
                value={club.tactics.kickingFocus}
                onChange={(e) =>
                  updateClubTactics({
                    kickingFocus: e.target.value as ClubTactics["kickingFocus"],
                  })
                }
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="territory">Territory (Pin Opponent Deep)</option>
                <option value="attacking">Attacking (Contestable Bombs)</option>
                <option value="retention">Retention (Short Kicks & Pressure)</option>
              </select>
            </div>

            {/* Goal Kicker */}
            <div>
              <label className="block text-xs font-semibold text-pitch-300 mb-1.5">
                Primary Goal Kicker
              </label>
              <select
                value={club.tactics.primaryGoalKickerId || ""}
                onChange={(e) =>
                  updateClubTactics({
                    primaryGoalKickerId: e.target.value || undefined,
                  })
                }
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">
                  Auto
                  {recommendedKicker
                    ? ` → ${recommendedKicker.name} (recommended)`
                    : " (best available)"}
                </option>
                {kickerCandidates.map((p) => {
                  const isRecommended = recommendedKicker?.id === p.id;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatPositionShort(p.position)}
                      {isRecommended ? " (recommended)" : ""}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-[10px] text-pitch-500">
                Recommended is the squad&apos;s best tee-kicker. Props are excluded.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Slot Selection Modal */}
      {selectedSlotIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-pitch-800">
              <h3 className="text-sm font-bold text-white">
                Select Player for {isBenchSlot ? `Interchange #${14 + selectedSlotIdx}` : `${formatPositionLabel(STARTING_POSITIONS[selectedSlotIdx])} (#${selectedSlotIdx + 1})`}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSlotIdx(null)}
                className="text-pitch-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 scrollbar-thin scrollbar-thumb-pitch-700">
              <button
                type="button"
                onClick={() => handleSelectPlayerForSlot(null)}
                className="w-full flex justify-between items-center p-2 rounded-xl border border-dashed border-pitch-700 hover:bg-pitch-800/60 text-xs font-semibold text-pitch-400"
              >
                <span>Clear Slot</span>
                <span>(Unassigned)</span>
              </button>

              {availablePlayers
                .filter((p) => !currentlySelectedIds.has(p.id))
                .sort((a, b) => b.rating - a.rating)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPlayerForSlot(p.id)}
                    className="w-full flex justify-between items-center p-2.5 rounded-xl border border-pitch-800 bg-pitch-950/60 hover:bg-pitch-800 hover:border-emerald-500/50 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300">
                        {formatPositionShort(p.position)}
                      </span>
                      <span className="text-xs font-bold text-white">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-400">{p.rating}</span>
                      <span className="text-[10px] text-pitch-400">OVR</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
