"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { STARTING_POSITIONS } from "@/lib/manager/rules";
import { formatPositionLabel, formatPositionShort } from "@/lib/manager";
import type { ClubLineup, Position } from "@/lib/manager/types";

export function ManagerTacticsView() {
  const { state, autoPickSquad, saveLineup } = useManager();
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [isBenchSlot, setIsBenchSlot] = useState<boolean>(false);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  if (!club) return null;

  const lineup = club.lineup;

  // Available players for selection (first team players who are not injured/suspended)
  const availablePlayers = Object.values(state.players).filter(
    (p) =>
      p.clubId === userClubId &&
      p.squadTier === "first" &&
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

    setSelectedSlotIdx(null);
  };

  const handleStyleChange = (style: any) => {
    club.tactics.style = style;
  };

  const handleIntensityChange = (intensity: any) => {
    club.tactics.trainingIntensity = intensity;
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-5">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Tactics & Matchday Lineup</h2>
          <p className="text-xs text-pitch-400">
            Select your starting 13 and 4 interchange substitutes. Tune team playstyle and intensity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => autoPickSquad()}
          className="self-start sm:self-auto rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all"
        >
          Auto Pick Optimal 17
        </button>
      </div>

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

              return (
                <div
                  key={slotIdx}
                  onClick={() => {
                    setSelectedSlotIdx(slotIdx);
                    setIsBenchSlot(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    player
                      ? "border-pitch-700/80 bg-pitch-900/60 hover:bg-pitch-800/60"
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
                      <span className="block text-xs font-bold text-white truncate">
                        {player ? player.name : "Empty Slot"}
                      </span>
                    </div>
                  </div>

                  {player ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-emerald-400">{player.rating}</span>
                      <span className="text-[10px] text-pitch-400">OVR</span>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold">+ Pick</span>
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

                return (
                  <div
                    key={benchIdx}
                    onClick={() => {
                      setSelectedSlotIdx(benchIdx);
                      setIsBenchSlot(true);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border cursor-pointer text-center transition-all ${
                      player
                        ? "border-pitch-700/80 bg-pitch-900/60 hover:bg-pitch-800/60"
                        : "border-dashed border-pitch-700 bg-pitch-950/40 hover:border-emerald-500"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-pitch-400">#{14 + benchIdx}</span>
                    <span className="text-xs font-bold text-white truncate w-full mt-0.5">
                      {player ? player.name : "+ Select"}
                    </span>
                    {player && (
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
                onChange={(e) => handleStyleChange(e.target.value)}
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="balanced">Balanced (Structured & Patient)</option>
                <option value="expansive">Expansive (Shift Early & High Risk)</option>
                <option value="attritional">Attritional (Arm-wrestle & Power)</option>
                <option value="direct">Direct (Hit the Ad-Line)</option>
              </select>
            </div>

            {/* Kicking Focus */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-pitch-300 mb-1.5">
                Kicking Philosophy
              </label>
              <select
                value={club.tactics.kickingFocus}
                onChange={(e) => (club.tactics.kickingFocus = e.target.value as any)}
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="territory">Territory (Pin Opponent Deep)</option>
                <option value="attacking">Attacking (Contestable Bombs)</option>
                <option value="retention">Retention (Short Kicks & Pressure)</option>
              </select>
            </div>

            {/* Training Intensity */}
            <div>
              <label className="block text-xs font-semibold text-pitch-300 mb-1.5">
                Match Intensity
              </label>
              <select
                value={club.tactics.trainingIntensity}
                onChange={(e) => handleIntensityChange(e.target.value)}
                className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="low">Low Intensity (-Fatigue, Safe)</option>
                <option value="normal">Normal Intensity (Standard Balance)</option>
                <option value="high">High Intensity (+Rating, +Injury Risk)</option>
              </select>
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
