"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { calculateSalaryCapUsage } from "@/lib/manager/contracts";
import {
  formatLedgerCategory,
  FACILITY_DEFINITIONS,
  getFacilityUpgradeCost,
  getCoachingUpgradeCost,
  getStadiumExpansionCost,
  type FacilityType,
} from "@/lib/manager";

export function ManagerClubView() {
  const {
    state,
    upgradeFacility,
    upgradeCoaching,
    expandStadiumCapacity,
  } = useManager();

  const [expansionSeats, setExpansionSeats] = useState<number>(1000);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  if (!club) return null;

  const cap = calculateSalaryCapUsage(state, userClubId);
  const finances = club.finances;
  const compId = club.competitionId;

  const handleFacilityUpgrade = (type: FacilityType) => {
    const res = upgradeFacility(type);
    if (res.success) {
      setFeedbackMessage({
        text: `Successfully upgraded ${FACILITY_DEFINITIONS[type].name}!`,
        isError: false,
      });
    } else {
      setFeedbackMessage({
        text: res.error || "Failed to upgrade facility.",
        isError: true,
      });
    }
  };

  const handleCoachingUpgrade = () => {
    const res = upgradeCoaching();
    if (res.success) {
      setFeedbackMessage({
        text: "Successfully upgraded coaching staff standard!",
        isError: false,
      });
    } else {
      setFeedbackMessage({
        text: res.error || "Failed to upgrade coaching staff.",
        isError: true,
      });
    }
  };

  const handleStadiumExpansion = () => {
    const res = expandStadiumCapacity(expansionSeats);
    if (res.success) {
      setFeedbackMessage({
        text: `Stadium expanded by +${expansionSeats.toLocaleString()} seats!`,
        isError: false,
      });
    } else {
      setFeedbackMessage({
        text: res.error || "Failed to expand stadium.",
        isError: true,
      });
    }
  };

  const facilityKeys: FacilityType[] = [
    "training",
    "youth",
    "medical",
    "performance",
    "analytics",
  ];

  const stadiumCost = getStadiumExpansionCost(expansionSeats, compId);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white">{club.name} Operations & Infrastructure</h2>
        <p className="text-xs text-pitch-400">
          Invest club treasury balance into world-class facilities, stadium capacity, and coaching to unlock career buffs for your squad.
        </p>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold ${
            feedbackMessage.isError
              ? "border border-rose-800/80 bg-rose-950/80 text-rose-200"
              : "border border-emerald-800/80 bg-emerald-950/80 text-emerald-200"
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-75 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid: Finances & Salary Cap */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Financial Balance Sheet */}
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white uppercase tracking-wider pb-2 border-b border-pitch-800">
            Treasury & Balance Sheet
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

        {/* Stadium Expansion & Home Ground */}
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-lg space-y-4">
          <h3 className="font-bold text-sm text-white uppercase tracking-wider pb-2 border-b border-pitch-800">
            Stadium Infrastructure & Expansion
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-pitch-800/60">
              <span className="text-pitch-400">Home Ground</span>
              <span className="font-bold text-white text-sm">{club.stadiumName}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-pitch-800/60">
              <span className="text-pitch-400">Current Capacity</span>
              <span className="font-bold text-emerald-400 text-sm">
                {club.facilities.stadiumCapacity.toLocaleString()} seats
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-pitch-800/60">
              <span className="text-pitch-400">Expansion Cost Tier</span>
              <span className="text-pitch-300 font-semibold">
                {compId === "super-league" ? "£115 / seat" : "£85 / seat"}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-pitch-950/80 p-3.5 border border-pitch-800 space-y-3">
            <span className="font-bold text-white text-xs block">Commission New Stand / Seating</span>
            <div className="grid grid-cols-4 gap-2">
              {[500, 1000, 2500, 5000].map((seats) => {
                const isSelected = expansionSeats === seats;
                return (
                  <button
                    key={seats}
                    type="button"
                    onClick={() => setExpansionSeats(seats)}
                    className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-sky-600 text-white shadow"
                        : "bg-pitch-900 text-pitch-300 border border-pitch-700 hover:border-pitch-600"
                    }`}
                  >
                    +{seats >= 1000 ? `${seats / 1000}k` : seats}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-xs pt-2 border-t border-pitch-800/60">
              <div>
                <span className="block text-pitch-400 text-[11px]">Investment Required:</span>
                <span className="text-sm font-bold text-amber-400">£{stadiumCost.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={handleStadiumExpansion}
                disabled={finances.balance < stadiumCost}
                className="rounded-xl bg-sky-600 px-4 py-2 font-bold text-xs text-white hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 transition-colors shadow"
              >
                Expand Stadium
              </button>
            </div>
          </div>

          {/* Board Confidence */}
          <div className="flex justify-between items-center pt-2 border-t border-pitch-800 text-xs">
            <span className="text-pitch-400">Board Confidence:</span>
            <span className="font-bold text-emerald-400">{club.boardConfidence}%</span>
          </div>
        </div>
      </div>

      {/* Facilities & Infrastructure Upgrades Suite */}
      <div className="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pitch-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Club Infrastructure & Training Facilities</h3>
            <p className="text-xs text-pitch-400">
              Upgraded departments directly increase player rating growth, lower injury rates, accelerate rehab, and stabilize morale.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 5 Facility Departments */}
          {facilityKeys.map((type) => {
            const def = FACILITY_DEFINITIONS[type];
            const currentLevel = club.facilities[type] || 3;
            const upgradeCost = getFacilityUpgradeCost(currentLevel, compId);
            const canAfford = upgradeCost !== null && finances.balance >= upgradeCost;

            return (
              <div
                key={type}
                className="flex flex-col justify-between rounded-xl border border-pitch-800 bg-pitch-950/70 p-4 transition-all hover:border-pitch-700"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{def.icon}</span>
                      <h4 className="font-bold text-sm text-white">{def.shortName}</h4>
                    </div>
                    <span className="text-amber-400 font-bold text-sm tracking-wider">
                      {"★".repeat(currentLevel)}
                      {"☆".repeat(5 - currentLevel)}
                    </span>
                  </div>

                  <p className="text-[11px] text-pitch-400 leading-relaxed">{def.description}</p>

                  <div className="space-y-1 pt-1.5">
                    <span className="text-[10px] font-bold uppercase text-pitch-400 tracking-wider">
                      Department Perks:
                    </span>
                    <ul className="space-y-1">
                      {def.perks.map((perk, idx) => (
                        <li key={idx} className="text-[11px] text-pitch-300 flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-pitch-800/80 flex items-center justify-between">
                  {currentLevel >= 5 ? (
                    <span className="rounded-lg bg-amber-950/60 border border-amber-800/60 px-3 py-1 text-[11px] font-bold text-amber-300 w-full text-center">
                      ★ World Class (Max Tier)
                    </span>
                  ) : (
                    <>
                      <div>
                        <span className="block text-[10px] text-pitch-400 uppercase">Upgrade Cost:</span>
                        <span className="text-xs font-bold text-emerald-400">
                          £{upgradeCost?.toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFacilityUpgrade(type)}
                        disabled={!canAfford}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors shadow"
                      >
                        Upgrade to ★{currentLevel + 1}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Coaching Staff Quality Card */}
          <div className="flex flex-col justify-between rounded-xl border border-pitch-800 bg-pitch-950/70 p-4 transition-all hover:border-pitch-700">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👔</span>
                  <h4 className="font-bold text-sm text-white">Coaching Staff Standard</h4>
                </div>
                <span className="text-amber-400 font-bold text-sm tracking-wider">
                  {"★".repeat(club.coachingQuality)}
                  {"☆".repeat(5 - club.coachingQuality)}
                </span>
              </div>

              <p className="text-[11px] text-pitch-400 leading-relaxed">
                Assistant coaches, strength and conditioning specialists, and positional mentors.
              </p>

              <div className="space-y-1 pt-1.5">
                <span className="text-[10px] font-bold uppercase text-pitch-400 tracking-wider">
                  Staff Perks:
                </span>
                <ul className="space-y-1">
                  <li className="text-[11px] text-pitch-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Directly boosts development growth rolls for all squad tiers</span>
                  </li>
                  <li className="text-[11px] text-pitch-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Improves match preparation and tactical execution</span>
                  </li>
                  <li className="text-[11px] text-pitch-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Elevates squad morale baseline</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-pitch-800/80 flex items-center justify-between">
              {club.coachingQuality >= 5 ? (
                <span className="rounded-lg bg-amber-950/60 border border-amber-800/60 px-3 py-1 text-[11px] font-bold text-amber-300 w-full text-center">
                  ★ Elite Coaching Staff (Max)
                </span>
              ) : (
                (() => {
                  const coachingCost = getCoachingUpgradeCost(club.coachingQuality, compId);
                  const canAffordCoaching = coachingCost !== null && finances.balance >= coachingCost;
                  return (
                    <>
                      <div>
                        <span className="block text-[10px] text-pitch-400 uppercase">Upgrade Cost:</span>
                        <span className="text-xs font-bold text-emerald-400">
                          £{coachingCost?.toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCoachingUpgrade}
                        disabled={!canAffordCoaching}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors shadow"
                      >
                        Upgrade to ★{club.coachingQuality + 1}
                      </button>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Board Objectives */}
      <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow">
        <h3 className="font-bold text-sm text-white mb-3 pb-2 border-b border-pitch-800">
          Board Directives & Strategic Objectives
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {club.boardObjectives.map((obj) => (
            <div key={obj.id} className="rounded-xl bg-pitch-950 p-3 border border-pitch-800 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">{obj.title}</span>
                <span className="text-[10px] uppercase font-bold text-pitch-400 rounded bg-pitch-900 px-2 py-0.5">
                  {obj.category}
                </span>
              </div>
              <p className="text-[11px] text-pitch-400">{obj.description}</p>
            </div>
          ))}
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
                  <td className="py-2 px-3 text-pitch-300">{formatLedgerCategory(tx.category)}</td>
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
