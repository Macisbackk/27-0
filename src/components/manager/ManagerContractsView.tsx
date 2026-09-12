"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { calculateSalaryCapUsage } from "@/lib/manager/contracts";
import { formatPositionShort, formatSquadRole } from "@/lib/manager";
import type { ManagerPlayer, SquadRole } from "@/lib/manager/types";

export function ManagerContractsView() {
  const { state, renewContract, releasePlayer } = useManager();
  const [filterExpiring, setFilterExpiring] = useState<boolean>(false);
  const [targetPlayer, setTargetPlayer] = useState<ManagerPlayer | null>(null);
  const [offeredWage, setOfferedWage] = useState<number>(2000);
  const [offeredYears, setOfferedYears] = useState<number>(2);
  const [offeredRole, setOfferedRole] = useState<SquadRole>("first_team");
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const currentSeason = state.calendar.currentSeason;
  const cap = calculateSalaryCapUsage(state, userClubId);

  let clubPlayers = Object.values(state.players).filter((p) => p.clubId === userClubId);

  if (filterExpiring) {
    clubPlayers = clubPlayers.filter((p) => p.contract && p.contract.expiresSeason <= currentSeason);
  }

  clubPlayers.sort((a, b) => (b.contract?.wageWeekly || 0) - (a.contract?.wageWeekly || 0));

  const openRenewalModal = (player: ManagerPlayer) => {
    const currentWage = player.contract?.wageWeekly || 1000;
    setTargetPlayer(player);
    setOfferedWage(Math.round(currentWage * 1.1));
    setOfferedYears(2);
    setOfferedRole(player.contract?.role || "first_team");
    setStatusMsg(null);
  };

  const handleExecuteRenewal = () => {
    if (!targetPlayer) return;
    const res = renewContract(targetPlayer.id, offeredWage, offeredYears, offeredRole);
    if (res.success) {
      setStatusMsg({ text: `Contract extension signed with ${targetPlayer.name}!`, isError: false });
      setTimeout(() => setTargetPlayer(null), 1200);
    } else {
      setStatusMsg({ text: res.error || "Renewal failed.", isError: true });
    }
  };

  const handleRelease = (playerId: string, name: string) => {
    if (confirm(`Are you sure you want to release ${name}? This will pay 4 weeks wages as severance.`)) {
      releasePlayer(playerId);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Contracts & Wage Management</h2>
          <p className="text-xs text-pitch-400">
            Monitor player expiry dates, negotiate extensions, and manage club commitments under the salary cap.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFilterExpiring(!filterExpiring)}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
            filterExpiring
              ? "bg-amber-600 text-white shadow"
              : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
          }`}
        >
          {filterExpiring ? "Show All Players" : "Show Expiring This Season Only"}
        </button>
      </div>

      {/* Salary Cap Status Box */}
      <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-4 shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 text-xs">
          <div>
            <span className="text-pitch-400">Total Wage Bill: </span>
            <span className="font-bold text-white">£{cap.totalWageBillWeekly.toLocaleString()}/wk</span>
            <span className="text-pitch-500"> (£{(cap.totalWageBillWeekly * 52).toLocaleString()}/yr)</span>
          </div>
          <div>
            <span className="text-pitch-400">Cap Limit: </span>
            <span className="font-bold text-sky-400">£{cap.capLimitWeekly.toLocaleString()}/wk</span>
            <span className="text-pitch-400 ml-3">Cap Room: </span>
            <span className={`font-bold ${cap.isOverCap ? "text-rose-400" : "text-emerald-400"}`}>
              £{Math.max(0, cap.availableCapWeekly).toLocaleString()}/wk
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full rounded-full bg-pitch-950 overflow-hidden border border-pitch-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              cap.isOverCap ? "bg-rose-500" : (cap.availableCapWeekly < 2000 ? "bg-amber-500" : "bg-emerald-500")
            }`}
            style={{ width: `${Math.min(100, (cap.capChargeWeekly / cap.capLimitWeekly) * 100)}%` }}
          />
        </div>
      </div>

      {/* Contracts Table */}
      <div className="overflow-x-auto rounded-2xl border border-pitch-800 bg-pitch-900/80 shadow">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-pitch-800 bg-pitch-950/80 text-pitch-400 font-semibold uppercase">
            <tr>
              <th className="py-3 px-3">Pos</th>
              <th className="py-3 px-3">Player</th>
              <th className="py-3 px-2 text-center">Age</th>
              <th className="py-3 px-2 text-center">OVR</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3 text-right">Weekly Wage</th>
              <th className="py-3 px-2 text-center">Expiry Year</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
            {clubPlayers.map((player) => {
              const isExpiring = player.contract && player.contract.expiresSeason <= currentSeason;

              return (
                <tr key={player.id} className="hover:bg-pitch-800/40">
                  <td className="py-2.5 px-3">
                    <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[11px] font-bold text-pitch-300">
                      {formatPositionShort(player.position)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-white">
                    <div className="flex items-center gap-2">
                      <span>{player.name}</span>
                      {isExpiring && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/40">
                          Expiring
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-pitch-400">{player.age}</td>
                  <td className="py-2.5 px-2 text-center font-bold text-white">{player.rating}</td>
                  <td className="py-2.5 px-3 text-pitch-300">
                    {player.contract?.role ? formatSquadRole(player.contract.role) : "Member"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    £{player.contract?.wageWeekly.toLocaleString() || "0"}/wk
                  </td>
                  <td className={`py-2.5 px-2 text-center font-bold ${isExpiring ? "text-amber-400" : "text-pitch-300"}`}>
                    {player.contract?.expiresSeason || "-"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openRenewalModal(player)}
                        className="rounded bg-emerald-600/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/40 transition-all"
                      >
                        Renew
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRelease(player.id, player.name)}
                        className="rounded bg-pitch-800 px-2.5 py-1 text-[11px] font-semibold text-pitch-400 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
                      >
                        Release
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Renewal Modal */}
      {targetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-pitch-800">
              <div>
                <h3 className="text-xl font-bold text-white">Renew {targetPlayer.name}</h3>
                <p className="text-xs text-pitch-400">
                  Current: £{targetPlayer.contract?.wageWeekly.toLocaleString()}/wk until {targetPlayer.contract?.expiresSeason}
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

            {statusMsg && (
              <div
                className={`mb-4 rounded-xl p-3 text-xs border ${
                  statusMsg.isError
                    ? "bg-rose-950/60 text-rose-300 border-rose-800"
                    : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <div className="space-y-3.5 mb-5 text-xs">
              <div>
                <label className="block font-semibold text-pitch-300 mb-1">
                  New Weekly Wage (£/wk)
                </label>
                <input
                  type="number"
                  step={100}
                  value={offeredWage}
                  onChange={(e) => setOfferedWage(Math.max(200, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Squad Role
                  </label>
                  <select
                    value={offeredRole}
                    onChange={(e) => setOfferedRole(e.target.value as SquadRole)}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="star">Star Player</option>
                    <option value="first_team">First Team</option>
                    <option value="rotation">Rotation</option>
                    <option value="backup">Backup</option>
                    <option value="youth">Youth</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-pitch-300 mb-1">
                    Extension Years
                  </label>
                  <select
                    value={offeredYears}
                    onChange={(e) => setOfferedYears(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={1}>1 Year ({currentSeason + 1})</option>
                    <option value={2}>2 Years ({currentSeason + 2})</option>
                    <option value={3}>3 Years ({currentSeason + 3})</option>
                    <option value={4}>4 Years ({currentSeason + 4})</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteRenewal}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition-all"
            >
              Sign Contract Extension
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
