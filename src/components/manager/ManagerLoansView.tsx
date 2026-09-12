"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { formatPositionLabel, formatPositionShort, formatSquadTier } from "@/lib/manager";
import type { ManagerPlayer } from "@/lib/manager/types";

export function ManagerLoansView() {
  const { state, loanPlayerOut, recallPlayerLoan } = useManager();
  const [subTab, setSubTab] = useState<"outgoing" | "incoming" | "available">("outgoing");
  const [targetPlayer, setTargetPlayer] = useState<ManagerPlayer | null>(null);
  const [destClubId, setDestClubId] = useState<string>("barrow-raiders");
  const [loanWeeks, setLoanWeeks] = useState<number>(8);
  const [wageShare, setWageShare] = useState<number>(50);
  const [canRecall, setCanRecall] = useState<boolean>(true);
  const [loanMsg, setLoanMsg] = useState<string | null>(null);

  if (!state) return null;

  const userClubId = state.manager.clubId;

  // Outgoing loans
  const outgoingLoans = state.transfers.activeLoans.filter((l) => l.parentClubId === userClubId);
  // Incoming loans
  const incomingLoans = state.transfers.activeLoans.filter((l) => l.destinationClubId === userClubId);

  // Available to loan out: Reserves & Academy players who are not currently loaned
  const availablePlayers = Object.values(state.players).filter(
    (p) =>
      p.clubId === userClubId &&
      (p.squadTier === "reserves" || p.squadTier === "academy") &&
      p.loan === null &&
      !p.injury &&
      !p.suspension
  );

  const otherClubs = Object.values(state.clubs).filter((c) => c.id !== userClubId);

  const handleExecuteLoan = () => {
    if (!targetPlayer) return;
    const res = loanPlayerOut(targetPlayer.id, destClubId, loanWeeks, wageShare, canRecall);
    if (res.success) {
      setLoanMsg(`Successfully arranged loan for ${targetPlayer.name}!`);
      setTimeout(() => {
        setTargetPlayer(null);
        setLoanMsg(null);
      }, 1200);
    } else {
      setLoanMsg(res.error || "Loan failed.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Loan Management</h2>
          <p className="text-xs text-pitch-400">
            Send youth and fringe players on loan for valuable match experience or loan in senior reinforcement.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubTab("outgoing")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "outgoing"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Outgoing ({outgoingLoans.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("incoming")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "incoming"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Incoming ({incomingLoans.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("available")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              subTab === "available"
                ? "bg-emerald-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            Loan Out Player ({availablePlayers.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Outgoing Loans */}
      {subTab === "outgoing" && (
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow">
          {outgoingLoans.length ? (
            <div className="space-y-2.5">
              {outgoingLoans.map((loan) => {
                const destClub = state.clubs[loan.destinationClubId];
                return (
                  <div
                    key={loan.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-pitch-800 bg-pitch-950/60 gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white">{loan.playerName}</h4>
                      <p className="text-xs text-pitch-400">
                        At {destClub?.name || loan.destinationClubId} · {loan.weeksRemaining} wks remaining · Wage split: {loan.wageContributionPct}% dest
                      </p>
                    </div>

                    {loan.canRecall && (
                      <button
                        type="button"
                        onClick={() => recallPlayerLoan(loan.playerId)}
                        className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-600/40 border border-amber-500/40 transition-colors"
                      >
                        Recall Loan Early
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-pitch-500 italic py-6 text-center">
              No players currently out on loan.
            </p>
          )}
        </div>
      )}

      {/* Tab 2: Incoming Loans */}
      {subTab === "incoming" && (
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow">
          {incomingLoans.length ? (
            <div className="space-y-2.5">
              {incomingLoans.map((loan) => {
                const parentClub = state.clubs[loan.parentClubId];
                return (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-pitch-800 bg-pitch-950/60"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white">{loan.playerName}</h4>
                      <p className="text-xs text-pitch-400">
                        On loan from {parentClub?.name || loan.parentClubId} · {loan.weeksRemaining} wks remaining
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400">Active</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-pitch-500 italic py-6 text-center">
              No players currently on loan at your club.
            </p>
          )}
        </div>
      )}

      {/* Tab 3: Available to Loan Out */}
      {subTab === "available" && (
        <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
              <tr>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-2 text-center">Age</th>
                <th className="py-3 px-2 text-center">Tier</th>
                <th className="py-3 px-2 text-center">OVR</th>
                <th className="py-3 px-2 text-center">Pot</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
              {availablePlayers.map((player) => (
                <tr key={player.id} className="hover:bg-pitch-800/40">
                  <td className="py-2.5 px-3">
                    <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300">
                      {formatPositionShort(player.position)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-white">{player.name}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{formatSquadTier(player.squadTier)}</td>
                  <td className="py-2.5 px-2 text-center font-bold text-white">{player.rating}</td>
                  <td className="py-2.5 px-2 text-center font-bold text-pitch-300">{player.potential}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetPlayer(player);
                        setLoanMsg(null);
                      }}
                      className="rounded bg-emerald-600/20 px-3 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                    >
                      Arrange Loan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loan Proposal Modal */}
      {targetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-pitch-800">
              <div>
                <h3 className="text-xl font-bold text-white">Loan Out {targetPlayer.name}</h3>
                <p className="text-xs text-pitch-400">
                  {formatPositionLabel(targetPlayer.position)} · {targetPlayer.age} yrs · {targetPlayer.rating} OVR
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetPlayer(null)}
                className="text-pitch-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loanMsg && (
              <div className="mb-4 rounded-xl bg-pitch-950 p-3 text-xs text-emerald-300 border border-emerald-800">
                {loanMsg}
              </div>
            )}

            <div className="space-y-3.5 mb-5 text-xs">
              <div>
                <label className="block font-semibold text-pitch-300 mb-1">
                  Destination Club
                </label>
                <select
                  value={destClubId}
                  onChange={(e) => setDestClubId(e.target.value)}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {otherClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.competitionId === "super-league" ? "Super League" : "Championship"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Duration (Weeks)
                  </label>
                  <select
                    value={loanWeeks}
                    onChange={(e) => setLoanWeeks(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={4}>4 Weeks</option>
                    <option value={8}>8 Weeks</option>
                    <option value={12}>12 Weeks</option>
                    <option value={16}>16 Weeks</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Destination Wage Share
                  </label>
                  <select
                    value={wageShare}
                    onChange={(e) => setWageShare(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={0}>0% (You pay 100%)</option>
                    <option value={50}>50% Split</option>
                    <option value={100}>100% (Destination pays all)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="canRecallLoan"
                  checked={canRecall}
                  onChange={(e) => setCanRecall(e.target.checked)}
                  className="rounded border-pitch-700 bg-pitch-950 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="canRecallLoan" className="text-pitch-300 cursor-pointer">
                  Allow early recall at any time
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteLoan}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition-all"
            >
              Confirm Loan Agreement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
