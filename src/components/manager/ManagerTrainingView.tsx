"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { setPlayerTrainingFocus } from "@/lib/manager/player";
import type { TrainingFocus, TrainingIntensity } from "@/lib/manager/types";

export function ManagerTrainingView() {
  const { state } = useManager();
  const [, setRerender] = useState({});

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  if (!club) return null;

  const clubPlayers = Object.values(state.players).filter((p) => p.clubId === userClubId);
  clubPlayers.sort((a, b) => b.rating - a.rating);

  const handleIntensityChange = (intensity: TrainingIntensity) => {
    club.tactics.trainingIntensity = intensity;
    setRerender({});
  };

  const handlePlayerFocusChange = (playerId: string, focus: TrainingFocus) => {
    const player = state.players[playerId];
    if (player) {
      state.players[playerId] = setPlayerTrainingFocus(player, focus);
      setRerender({});
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">Training & Conditioning</h2>
        <p className="text-xs text-pitch-400">
          Balance weekly match sharpness and player growth against fatigue and injury prevention.
        </p>
      </div>

      {/* Top Banner: Training Intensity & Trade-offs */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-4 shadow">
          <h3 className="font-bold text-sm text-white mb-2">Team Intensity Level</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {(["low", "normal", "high"] as TrainingIntensity[]).map((level) => {
              const isSelected = club.tactics.trainingIntensity === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleIntensityChange(level)}
                  className={`rounded-xl py-2 text-xs font-bold capitalize transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-pitch-950 text-pitch-400 hover:text-white border border-pitch-800"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-pitch-400 mt-2.5">
            {club.tactics.trainingIntensity === "high"
              ? "High Intensity: Boosts match rating and development speed, but increases fatigue and injury risk."
              : club.tactics.trainingIntensity === "low"
              ? "Low Intensity: Drops fatigue quickly and protects fitness, but provides modest development."
              : "Normal Intensity: Balanced standard workload between development and recovery."}
          </p>
        </div>

        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow text-xs space-y-2">
          <h3 className="font-bold text-sm text-white">Training Facilities</h3>
          <div className="flex justify-between">
            <span className="text-pitch-400">Senior Gym & Pitches:</span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.training)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-pitch-400">Youth Academy Complex:</span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.youth)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-pitch-400">Coaching Staff Quality:</span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.coachingQuality)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow text-xs space-y-1.5">
          <h3 className="font-bold text-sm text-white">Development Science</h3>
          <p className="text-pitch-400 text-[11px]">
            Players aged 17–23 with high potential develop fastest with regular playing time and Development focus.
          </p>
          <p className="text-pitch-400 text-[11px]">
            Veterans (32+) plateau and gradually decline. Use Recovery focus to preserve their stamina.
          </p>
        </div>
      </div>

      {/* Individual Training Focus Table */}
      <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
            <tr>
              <th className="py-3 px-3">Pos</th>
              <th className="py-3 px-3">Player</th>
              <th className="py-3 px-2 text-center">Age</th>
              <th className="py-3 px-2 text-center">OVR</th>
              <th className="py-3 px-2 text-center">Pot</th>
              <th className="py-3 px-2 text-center">Fatigue</th>
              <th className="py-3 px-2 text-center">Fitness</th>
              <th className="py-3 px-3 text-right">Individual Focus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
            {clubPlayers.map((player) => (
              <tr key={player.id} className="hover:bg-pitch-800/40">
                <td className="py-2.5 px-3">
                  <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300">
                    {player.position.slice(0, 2)}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-medium text-white">{player.name}</td>
                <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>
                <td className="py-2.5 px-2 text-center font-bold text-white">{player.rating}</td>
                <td className="py-2.5 px-2 text-center font-bold text-pitch-300">{player.potential}</td>
                <td className="py-2.5 px-2 text-center">
                  <span
                    className={`font-semibold ${
                      player.fatigue > 50 ? "text-rose-400" : player.fatigue > 25 ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {player.fatigue}%
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center text-pitch-300 font-semibold">{player.fitness}%</td>
                <td className="py-2.5 px-3 text-right">
                  <select
                    value={player.trainingFocus}
                    onChange={(e) => handlePlayerFocusChange(player.id, e.target.value as TrainingFocus)}
                    className="rounded-lg border border-pitch-700 bg-pitch-950 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="balanced">Balanced</option>
                    <option value="attack">Attack</option>
                    <option value="defence">Defence</option>
                    <option value="fitness">Fitness</option>
                    <option value="recovery">Recovery</option>
                    <option value="development">Development</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
