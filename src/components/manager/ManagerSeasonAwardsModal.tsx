"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";

export function ManagerSeasonAwardsModal() {
  const { seasonAwardsModal, setSeasonAwardsModal, rolloverCurrentSeason, isAdvancing, state } =
    useManager();

  if (!seasonAwardsModal || !state) return null;

  const awards = seasonAwardsModal;
  const newSeasonNumber = state.calendar.currentSeason + 1;

  const handleStartNextSeason = async () => {
    rolloverCurrentSeason();
    setSeasonAwardsModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-pitch-700 bg-pitch-950 p-6 sm:p-8 shadow-2xl space-y-6 scrollbar-thin scrollbar-thumb-pitch-700">
        {/* Banner Eyebrow */}
        <div className="text-center space-y-1">
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-400 border border-amber-500/30 uppercase tracking-widest inline-block">
            End of Season Honours
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Season {state.calendar.currentSeason} Complete
          </h2>
          <p className="text-xs text-pitch-400">
            All domestic league and cup fixtures have concluded. Here are the official season awards.
          </p>
        </div>

        {/* Champions & Silverware */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Super League Champions */}
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-pitch-900 p-4 text-center space-y-1">
            <span className="text-3xl">🏆</span>
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
              Super League Champions
            </span>
            <h3 className="text-base font-black text-white">{awards.superLeagueChampion}</h3>
          </div>

          {/* Championship Winners */}
          <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-b from-sky-500/10 to-pitch-900 p-4 text-center space-y-1">
            <span className="text-3xl">🛡️</span>
            <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block">
              Championship Champions
            </span>
            <h3 className="text-base font-black text-white">{awards.championshipChampion}</h3>
          </div>
        </div>

        {/* Promotion & Relegation Bulletin */}
        <div className="rounded-2xl border border-pitch-750 bg-pitch-900/60 p-4 space-y-3">
          <h4 className="text-xs font-black text-pitch-400 uppercase tracking-wider">
            Promotion &amp; Relegation
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
              <span className="text-[10px] font-bold text-emerald-400 uppercase block">
                ▲ Promoted to Super League
              </span>
              <p className="text-sm font-black text-white mt-1">
                {awards.promotedClub || "None"}
              </p>
            </div>
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3">
              <span className="text-[10px] font-bold text-rose-400 uppercase block">
                ▼ Relegated to Championship
              </span>
              <p className="text-sm font-black text-white mt-1">
                {awards.relegatedClub || "None"}
              </p>
            </div>
          </div>
        </div>

        {/* Individual Accolades */}
        <div className="grid gap-3 sm:grid-cols-2">
          {awards.manOfSteel && (
            <div className="rounded-xl border border-pitch-800 bg-pitch-900/50 p-3">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                ⭐ Man of Steel
              </span>
              <p className="text-sm font-bold text-white mt-0.5">{awards.manOfSteel.name}</p>
              <p className="text-xs text-pitch-400">
                {awards.manOfSteel.clubName} · {awards.manOfSteel.motm} Man of the Match awards
              </p>
            </div>
          )}

          {awards.topTryScorer && (
            <div className="rounded-xl border border-pitch-800 bg-pitch-900/50 p-3">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                ⚡ Top Try Scorer
              </span>
              <p className="text-sm font-bold text-white mt-0.5">{awards.topTryScorer.name}</p>
              <p className="text-xs text-pitch-400">
                {awards.topTryScorer.clubName} · {awards.topTryScorer.tries} tries
              </p>
            </div>
          )}
        </div>

        {/* Rollover Action */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isAdvancing}
            onClick={handleStartNextSeason}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3.5 text-center text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all disabled:opacity-50"
          >
            {isAdvancing ? "Transitioning Season..." : `Begin Season ${newSeasonNumber} →`}
          </button>
          <p className="text-[11px] text-pitch-400 text-center mt-2">
            Will age players, process retirements, intake new academy youth, and generate the new
            competition fixture lists.
          </p>
        </div>
      </div>
    </div>
  );
}
