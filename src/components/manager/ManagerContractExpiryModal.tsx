"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import {
  estimateContractMonthsRemaining,
  formatPositionShort,
  formatSquadTier,
} from "@/lib/manager";

export function ManagerContractExpiryModal() {
  const {
    state,
    contractExpiryModalPlayers,
    dismissContractExpiryModal,
    setActiveTab,
  } = useManager();

  if (!state || !contractExpiryModalPlayers || contractExpiryModalPlayers.length === 0) {
    return null;
  }

  const { currentSeason, currentWeek } = state.calendar;

  const handleReviewContracts = () => {
    dismissContractExpiryModal();
    setActiveTab("contracts");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-500/40 bg-pitch-950 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-400 border border-amber-500/30 uppercase tracking-widest inline-block">
            Contract Alert
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Deals Running Down
          </h2>
          <p className="text-xs text-pitch-400">
            {contractExpiryModalPlayers.length} player
            {contractExpiryModalPlayers.length === 1 ? " has" : "s have"} less than 6 months
            left on their contract. Renew soon or risk losing them as free agents at season end.
          </p>
        </div>

        <ul className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {contractExpiryModalPlayers.map((player) => {
            const monthsLeft = estimateContractMonthsRemaining(
              currentSeason,
              currentWeek,
              player.contract!.expiresSeason
            );
            const monthsLabel =
              monthsLeft <= 0
                ? "Expired"
                : monthsLeft < 1
                  ? "Under 1 month"
                  : `~${monthsLeft.toFixed(1)} months`;

            return (
              <li
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300">
                      {formatPositionShort(player.position)}
                    </span>
                    <span className="font-bold text-sm text-white truncate">{player.name}</span>
                  </div>
                  <p className="text-[11px] text-pitch-400 mt-0.5">
                    {player.squadTier ? formatSquadTier(player.squadTier) : "Squad"} · OVR{" "}
                    {player.rating} · Expires {player.contract!.expiresSeason}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-1 text-[10px] font-black text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                  {monthsLabel}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={handleReviewContracts}
            className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3 text-center text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all"
          >
            Review Contracts →
          </button>
          <button
            type="button"
            onClick={() => dismissContractExpiryModal()}
            className="flex-1 rounded-2xl border border-pitch-700 bg-pitch-900 py-3 text-center text-sm font-bold text-pitch-200 hover:bg-pitch-800 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
