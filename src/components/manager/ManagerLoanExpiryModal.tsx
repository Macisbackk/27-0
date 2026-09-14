"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import { formatPositionShort } from "@/lib/manager";
import { uiLayerClass } from "@/lib/ui/layers";

export function ManagerLoanExpiryModal() {
  const {
    state,
    loanExpiryModalAlerts,
    dismissLoanExpiryModal,
    setActiveTab,
  } = useManager();

  if (!state || !loanExpiryModalAlerts || loanExpiryModalAlerts.length === 0) {
    return null;
  }

  const handleReviewLoans = () => {
    dismissLoanExpiryModal();
    setActiveTab("loans");
  };

  return (
    <div
      className={`fixed inset-0 ${uiLayerClass("modalBackdrop")} flex items-center justify-center bg-black p-3 sm:p-5`}
      role="dialog"
      aria-modal="true"
      aria-label="Loan expiry alert"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-violet-500/40 bg-pitch-950 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-300 border border-violet-500/30 uppercase tracking-widest inline-block">
            Loan Alert
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Loans Running Down
          </h2>
          <p className="text-xs text-pitch-400">
            {loanExpiryModalAlerts.length} loan
            {loanExpiryModalAlerts.length === 1 ? " has" : "s have"} 2 weeks or fewer
            remaining. Review recall options or prepare for returns.
          </p>
        </div>

        <ul className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {loanExpiryModalAlerts.map((alert) => {
            const player = state.players[alert.playerId];
            const otherClub = state.clubs[alert.otherClubId];
            const weeksLabel =
              alert.weeksRemaining <= 0
                ? "Expiring now"
                : alert.weeksRemaining === 1
                  ? "1 week left"
                  : `${alert.weeksRemaining} weeks left`;

            return (
              <li
                key={alert.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {player && (
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300">
                        {formatPositionShort(player.position)}
                      </span>
                    )}
                    <span className="font-bold text-sm text-white truncate">
                      {alert.playerName}
                    </span>
                  </div>
                  <p className="text-[11px] text-pitch-400 mt-0.5">
                    {alert.direction === "in" ? "On loan from" : "Out on loan at"}{" "}
                    {otherClub?.name || alert.otherClubId}
                    {alert.canRecall ? " · Recallable" : ""}
                    {player ? ` · OVR ${player.rating}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-violet-500/20 px-2 py-1 text-[10px] font-black text-violet-200 border border-violet-500/30 uppercase tracking-wide">
                  {weeksLabel}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={handleReviewLoans}
            className="flex-1 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-400 py-3 text-center text-sm font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all"
          >
            Review Loans →
          </button>
          <button
            type="button"
            onClick={() => dismissLoanExpiryModal()}
            className="flex-1 rounded-2xl border border-pitch-700 bg-pitch-900 py-3 text-center text-sm font-bold text-pitch-200 hover:bg-pitch-800 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
