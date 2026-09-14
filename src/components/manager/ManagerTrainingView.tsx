"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import { formatPositionPair } from "@/lib/manager";
import type { TrainingFocus, TrainingIntensity } from "@/lib/manager/types";

export function ManagerTrainingView() {
  const { state, setTrainingFocus, setTrainingIntensity } = useManager();

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  if (!club) return null;

  const clubPlayers = Object.values(state.players).filter((p) => p.clubId === userClubId);
  clubPlayers.sort((a, b) => b.rating - a.rating);

  const handleIntensityChange = (intensity: TrainingIntensity) => {
    setTrainingIntensity(intensity);
  };

  const handlePlayerFocusChange = (playerId: string, focus: TrainingFocus) => {
    setTrainingFocus(playerId, focus);
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-5">
      <div>
        <h2 className="text-lg sm:text-2xl font-black text-white">Training</h2>
        <p className="hidden sm:block text-xs text-pitch-400">
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
          <p className="hidden sm:block text-[11px] text-pitch-400 mt-2.5">
            {club.tactics.trainingIntensity === "high"
              ? "High Intensity: Boosts match rating and development speed, but increases fatigue and injury risk."
              : club.tactics.trainingIntensity === "low"
              ? "Low Intensity: Drops fatigue quickly and protects fitness, but provides modest development."
              : "Normal Intensity: Balanced standard workload between development and recovery."}
          </p>
        </div>

        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow text-xs space-y-2">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-sm text-white">Infrastructure Standards</h3>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-pitch-400">
              <span className="sm:hidden">Training</span>
              <span className="hidden sm:inline">Senior Training Ground</span>:
            </span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.training || 3)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-pitch-400">
              <span className="sm:hidden">Youth</span>
              <span className="hidden sm:inline">Youth Academy Complex</span>:
            </span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.youth || 3)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-pitch-400">
              <span className="sm:hidden">Medical</span>
              <span className="hidden sm:inline">Medical & Rehab Centre</span>:
            </span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.medical || 3)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-pitch-400">
              <span className="sm:hidden">Science</span>
              <span className="hidden sm:inline">Sports Science & Conditioning</span>:
            </span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.performance || 3)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-pitch-400">
              <span className="sm:hidden">Analytics</span>
              <span className="hidden sm:inline">Tactical Analytics Suite</span>:
            </span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.analytics || 2)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-pitch-800/60">
            <span className="text-pitch-400">
              <span className="sm:hidden">Coaching</span>
              <span className="hidden sm:inline">Coaching Staff Quality</span>:
            </span>
            <span className="text-amber-400 font-bold">{"★".repeat(club.coachingQuality || 3)}</span>
          </div>
        </div>

        <div className="hidden sm:block rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow text-xs space-y-2">
          <h3 className="font-bold text-sm text-white">Development & Science Notes</h3>
          <p className="text-pitch-400 text-[11px] leading-relaxed">
            <strong className="text-emerald-400 font-semibold">Growth:</strong> Players aged 17–23 with high potential develop fastest with regular first-team minutes and higher coaching standards.
          </p>
          <p className="text-pitch-400 text-[11px] leading-relaxed">
            <strong className="text-sky-400 font-semibold">Conditioning:</strong> Upgraded Sports Science labs shed extra weekly fatigue and shield veterans (32+) against physical decline.
          </p>
          <p className="text-pitch-400 text-[11px] leading-relaxed">
            <strong className="text-amber-400 font-semibold">Career Programs:</strong> Sponsoring direct player career masterclasses or specialist biomechanics permanently boosts player upside.
          </p>
        </div>
      </div>

      {/* Individual Training Focus — mobile */}
      <div className="sm:hidden space-y-2">
        {clubPlayers.map((player) => (
          <div
            key={player.id}
            className="rounded-xl border border-pitch-800 bg-pitch-900/80 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span className="shrink-0 rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300">
                  {formatPositionPair(player.position, player.secondaryPosition)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{player.name}</p>
                  <p className="text-[11px] text-pitch-400">
                    Fat {player.fatigue}% · Fit {player.fitness}%
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-black text-emerald-400 leading-none">{player.rating}</p>
                <p className="text-[10px] text-pitch-500">POT {player.potential}</p>
              </div>
            </div>
            <select
              value={player.trainingFocus}
              onChange={(e) => handlePlayerFocusChange(player.id, e.target.value as TrainingFocus)}
              className="mt-2 w-full rounded-lg border border-pitch-700 bg-pitch-950 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="balanced">Balanced</option>
              <option value="attack">Attack</option>
              <option value="defence">Defence</option>
              <option value="fitness">Fitness</option>
              <option value="recovery">Recovery</option>
              <option value="development">Development</option>
            </select>
          </div>
        ))}
      </div>

      {/* Individual Training Focus Table — desktop */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
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
                    {formatPositionPair(player.position, player.secondaryPosition)}
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
