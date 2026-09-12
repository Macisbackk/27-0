"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import type { ManagerFixture } from "@/lib/manager/types";

export function ManagerMatchReviewModal() {
  const { lastPlayedMatchReview, setLastPlayedMatchReview, state } = useManager();

  if (!lastPlayedMatchReview || !state) return null;

  const fixture: ManagerFixture = lastPlayedMatchReview;
  const homeClub = state.clubs[fixture.homeClubId];
  const awayClub = state.clubs[fixture.awayClubId];

  const motmPlayer = fixture.manOfTheMatchPlayerId
    ? state.players[fixture.manOfTheMatchPlayerId]
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-pitch-700 bg-pitch-950 p-5 sm:p-7 shadow-2xl space-y-5 scrollbar-thin scrollbar-thumb-pitch-700">
        {/* Header Eyebrow */}
        <div className="flex items-center justify-between border-b border-pitch-800 pb-3">
          <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            {fixture.roundName} Review
          </span>
          <button
            type="button"
            onClick={() => setLastPlayedMatchReview(null)}
            className="text-pitch-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Scoreboard Hero Banner */}
        <div className="rounded-2xl border border-pitch-750 bg-gradient-to-b from-pitch-900 to-pitch-950 p-5 text-center shadow-lg">
          <div className="grid grid-cols-5 items-center gap-2">
            {/* Home Club */}
            <div className="col-span-2 flex flex-col items-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20 mb-2"
                style={{
                  backgroundColor: homeClub?.primaryColor || "#1E4D9B",
                  color: homeClub?.textColour || "#FFFFFF",
                }}
              >
                {homeClub?.abbreviation || "HME"}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">{homeClub?.name}</h3>
            </div>

            {/* Score */}
            <div className="col-span-1 flex flex-col items-center">
              <div className="flex items-center gap-2 text-3xl sm:text-4xl font-black text-white tracking-tight">
                <span className={fixture.homeScore! > fixture.awayScore! ? "text-emerald-400" : "text-white"}>
                  {fixture.homeScore}
                </span>
                <span className="text-pitch-600">-</span>
                <span className={fixture.awayScore! > fixture.homeScore! ? "text-emerald-400" : "text-white"}>
                  {fixture.awayScore}
                </span>
              </div>
              <span className="text-[11px] font-bold text-pitch-400 uppercase tracking-wider mt-1">
                Full Time
              </span>
            </div>

            {/* Away Club */}
            <div className="col-span-2 flex flex-col items-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20 mb-2"
                style={{
                  backgroundColor: awayClub?.primaryColor || "#C8102E",
                  color: awayClub?.textColour || "#FFFFFF",
                }}
              >
                {awayClub?.abbreviation || "AWY"}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">{awayClub?.name}</h3>
            </div>
          </div>

          <p className="text-xs text-pitch-400 mt-4 border-t border-pitch-800/60 pt-2">
            {homeClub?.stadiumName} · Attendance: {fixture.attendance?.toLocaleString()}
          </p>
        </div>

        {/* Man of the Match */}
        {motmPlayer && (
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Man of the Match
                </span>
                <h4 className="text-sm font-black text-white">{motmPlayer.name}</h4>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-300">
              {motmPlayer.position} · {state.clubs[motmPlayer.clubId || ""]?.name}
            </span>
          </div>
        )}

        {/* Score Events Timeline */}
        {fixture.scoreEvents && fixture.scoreEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-pitch-400 uppercase tracking-wider">
              Scoring Timeline
            </h4>
            <div className="rounded-xl border border-pitch-800 bg-pitch-900/60 divide-y divide-pitch-800/40 max-h-48 overflow-y-auto">
              {fixture.scoreEvents.map((evt, idx) => {
                const isHome = evt.clubId === fixture.homeClubId;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2 px-3 text-xs ${
                      isHome ? "text-white" : "text-pitch-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-400">
                        {evt.minute}&apos;
                      </span>
                      <span className="font-bold text-emerald-400">{evt.type}</span>
                      <span>{evt.playerName}</span>
                    </div>
                    <span className="text-[11px] text-pitch-400 font-semibold">
                      {isHome ? homeClub?.shortName : awayClub?.shortName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player Performances */}
        {fixture.playerPerformances && fixture.playerPerformances.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-pitch-400 uppercase tracking-wider">
              Player Ratings
            </h4>
            <div className="rounded-xl border border-pitch-800 bg-pitch-900/60 max-h-56 overflow-y-auto divide-y divide-pitch-800/40">
              {fixture.playerPerformances.map((perf, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-pitch-400 w-6">
                      {perf.position.slice(0, 2)}
                    </span>
                    <span className="font-medium text-white">{perf.playerName}</span>
                    {perf.tries > 0 && (
                      <span className="text-emerald-400 font-bold">
                        ({perf.tries} {perf.tries === 1 ? "try" : "tries"})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black text-xs ${
                        perf.rating >= 8.0
                          ? "text-emerald-400"
                          : perf.rating >= 7.0
                          ? "text-sky-400"
                          : "text-pitch-300"
                      }`}
                    >
                      {perf.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => setLastPlayedMatchReview(null)}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition-all"
        >
          Return to Hub
        </button>
      </div>
    </div>
  );
}
