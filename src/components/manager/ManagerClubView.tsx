"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import { calculateSalaryCapUsage } from "@/lib/manager/contracts";

export function ManagerClubView() {
  const { state } = useManager();

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  if (!club) return null;

  const cap = calculateSalaryCapUsage(state, userClubId);
  const finances = club.finances;

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">{club.name} Club Overview</h2>
        <p className="text-xs text-pitch-400">
          Financial health, facilities ratings, board expectations, and operational ledger.
        </p>
      </div>

      {/* Grid: Finances & Facilities */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left: Financial Statement */}
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white uppercase tracking-wider pb-2 border-b border-pitch-800">
            Financial Balance Sheet
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-pitch-950/70 p-3 border border-pitch-800">
              <span className="block text-pitch-400">Cash Balance</span>
              <span className="text-xl font-black text-emerald-400">
                £{finances.balance.toLocaleString()}
              </span>
            </div>
            <div className="rounded-xl bg-pitch-950/70 p-3 border border-pitch-800">
              <span className="block text-pitch-400">Transfer Budget</span>
              <span className="text-xl font-black text-sky-400">
                £{finances.transferBudget.toLocaleString()}
              </span>
            </div>
            <div className="rounded-xl bg-pitch-950/70 p-3 border border-pitch-800">
              <span className="block text-pitch-400">Season Revenue</span>
              <span className="text-base font-bold text-emerald-400">
                +£{finances.seasonRevenue.toLocaleString()}
              </span>
            </div>
            <div className="rounded-xl bg-pitch-950/70 p-3 border border-pitch-800">
              <span className="block text-pitch-400">Season Expenses</span>
              <span className="text-base font-bold text-rose-400">
                -£{finances.seasonExpenses.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Salary Cap Details */}
          <div className="rounded-xl bg-pitch-950/70 p-3.5 border border-pitch-800 space-y-2 text-xs">
            <span className="font-bold text-white block">Salary Cap Breakdown</span>
            <div className="flex justify-between">
              <span className="text-pitch-400">Weekly Cap Charge:</span>
              <span className="font-semibold text-white">£{cap.capChargeWeekly.toLocaleString()}/wk</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pitch-400">Division Cap Ceiling:</span>
              <span className="font-semibold text-sky-400">£{cap.capLimitWeekly.toLocaleString()}/wk</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-pitch-800">
              <span className="text-pitch-400">Available Cap Headroom:</span>
              <span className={`font-bold ${cap.isOverCap ? "text-rose-400" : "text-emerald-400"}`}>
                £{Math.max(0, cap.availableCapWeekly).toLocaleString()}/wk
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stadium, Facilities & Board */}
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white uppercase tracking-wider pb-2 border-b border-pitch-800">
            Infrastructure & Facilities
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-pitch-800/60">
              <span className="text-pitch-400">Home Ground</span>
              <span className="font-bold text-white">{club.stadiumName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-pitch-800/60">
              <span className="text-pitch-400">Capacity</span>
              <span className="font-bold text-white">{club.facilities.stadiumCapacity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-pitch-800/60">
              <span className="text-pitch-400">Senior Training Ground</span>
              <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.training)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-pitch-800/60">
              <span className="text-pitch-400">Youth Academy Complex</span>
              <span className="text-amber-400 font-bold">{"★".repeat(club.facilities.youth)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-pitch-400">Coaching Staff Standard</span>
              <span className="text-amber-400 font-bold">{"★".repeat(club.coachingQuality)}</span>
            </div>
          </div>

          {/* Board Objectives */}
          <div className="pt-2 border-t border-pitch-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-xs text-white">Board Objectives</span>
              <span className="text-xs text-emerald-400 font-bold">Confidence: {club.boardConfidence}%</span>
            </div>
            <div className="space-y-2">
              {club.boardObjectives.map((obj) => (
                <div key={obj.id} className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{obj.title}</span>
                    <span className="text-[10px] uppercase font-bold text-pitch-400">{obj.category}</span>
                  </div>
                  <p className="text-[11px] text-pitch-400 mt-0.5">{obj.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Transactions Ledger */}
      <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow">
        <h3 className="font-bold text-sm text-white mb-3 pb-2 border-b border-pitch-800">
          Financial Ledger (Recent Transactions)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-pitch-800 bg-pitch-950/60 text-pitch-400 uppercase">
              <tr>
                <th className="py-2.5 px-3">Week</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/40 text-pitch-300">
              {finances.history.slice(0, 15).map((tx) => (
                <tr key={tx.id} className="hover:bg-pitch-800/30">
                  <td className="py-2 px-3 text-pitch-400">Wk {tx.week}</td>
                  <td className="py-2 px-3 capitalize text-pitch-300">{tx.category.replace("_", " ")}</td>
                  <td className="py-2 px-3 font-medium text-white">{tx.description}</td>
                  <td
                    className={`py-2 px-3 text-right font-bold ${
                      tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {tx.amount >= 0 ? `+£${tx.amount.toLocaleString()}` : `-£${Math.abs(tx.amount).toLocaleString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
