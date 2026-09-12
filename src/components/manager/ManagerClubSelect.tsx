"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import {
  CLUB_REPUTATION_BY_NAME,
  CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME,
} from "../../../data/club-reputation";
import { STADIUMS, CLUB_COLORS, toClubId } from "@/lib/manager/database";
import { TYPO } from "@/lib/ui/typography";
import { BTN } from "@/lib/ui/design-system";

export function ManagerClubSelect() {
  const { startNewGame } = useManager();
  const [activeTier, setActiveTier] = useState<"championship" | "super-league">("championship");
  const [selectedClubName, setSelectedClubName] = useState<string>("Widnes Vikings");
  const [managerName, setManagerName] = useState<string>("Coach");

  const champClubs = [
    "Salford RLFC",
    "London Broncos",
    "Widnes Vikings",
    "Halifax Panthers",
    "Sheffield Eagles",
    "Oldham RLFC",
    "Doncaster RLFC",
    "Barrow Raiders",
    "Batley Bulldogs",
    "Newcastle Thunder",
    "Hunslet RLFC",
    "Whitehaven RLFC",
  ];

  const slClubs = Object.keys(CLUB_REPUTATION_BY_NAME);

  const displayClubs = activeTier === "championship" ? champClubs : slClubs;

  const currentClubRep =
    activeTier === "championship"
      ? CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[selectedClubName] || 2
      : CLUB_REPUTATION_BY_NAME[selectedClubName] || 3;

  const currentStadium = STADIUMS[selectedClubName] || { name: "Community Stadium", capacity: 8000 };
  const currentColors = CLUB_COLORS[selectedClubName] || { primary: "#1E4D9B", text: "#FFFFFF" };

  const handleStart = () => {
    const clubId = toClubId(selectedClubName);
    startNewGame(clubId, managerName.trim() || "Coach");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider mb-2">
          New Manager Career
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Select Your Club
        </h1>
        <p className="mt-2 text-sm sm:text-base text-pitch-300 max-w-xl mx-auto">
          Take full control of squad tactics, training, reserve grades, youth development, transfers, and finances under the salary cap.
        </p>
      </div>

      {/* Tier Switcher */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-xl bg-pitch-900 p-1 border border-pitch-800">
          <button
            type="button"
            onClick={() => {
              setActiveTier("championship");
              setSelectedClubName("Widnes Vikings");
            }}
            className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
              activeTier === "championship"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-pitch-400 hover:text-white"
            }`}
          >
            Championship (Promotion Challenge)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTier("super-league");
              setSelectedClubName("Wigan Warriors");
            }}
            className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
              activeTier === "super-league"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-pitch-400 hover:text-white"
            }`}
          >
            Super League (Elite Competition)
          </button>
        </div>
      </div>

      {/* Main Grid: Clubs List + Selected Preview */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Club Selection Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pitch-700">
          {displayClubs.map((clubName) => {
            const isSelected = selectedClubName === clubName;
            const stars =
              activeTier === "championship"
                ? CHAMPIONSHIP_CLUB_REPUTATION_BY_NAME[clubName] || 2
                : CLUB_REPUTATION_BY_NAME[clubName] || 3;
            const colors = CLUB_COLORS[clubName] || { primary: "#1E4D9B", text: "#FFFFFF" };

            return (
              <button
                key={clubName}
                type="button"
                onClick={() => setSelectedClubName(clubName)}
                className={`flex flex-col items-center justify-between p-3 rounded-xl border text-center transition-all ${
                  isSelected
                    ? "border-emerald-400 bg-pitch-800/90 ring-2 ring-emerald-500/50 shadow-md"
                    : "border-pitch-800 bg-pitch-900/60 hover:bg-pitch-800/60 hover:border-pitch-700"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm mb-2 border border-white/20"
                  style={{ backgroundColor: colors.primary, color: colors.text }}
                >
                  {clubName.slice(0, 3).toUpperCase()}
                </div>
                <div className="font-bold text-xs text-white truncate w-full">
                  {clubName}
                </div>
                <div className="flex gap-0.5 mt-1 text-amber-400 text-xs">
                  {"★".repeat(stars)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Club Profile & Launch Form */}
        <div className="lg:col-span-5 rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-pitch-800">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20"
              style={{ backgroundColor: currentColors.primary, color: currentColors.text }}
            >
              {selectedClubName.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{selectedClubName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-pitch-300 uppercase tracking-wide">
                  {activeTier === "championship" ? "Championship" : "Super League"}
                </span>
                <span className="text-amber-400 text-sm">
                  {"★".repeat(currentClubRep)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-pitch-300 mb-5">
            <div className="flex justify-between py-1 border-b border-pitch-800/50">
              <span className="text-pitch-400">Home Ground</span>
              <span className="font-semibold text-white">{currentStadium.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-pitch-800/50">
              <span className="text-pitch-400">Capacity</span>
              <span className="font-semibold text-white">{currentStadium.capacity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-pitch-800/50">
              <span className="text-pitch-400">Starting Balance</span>
              <span className="font-semibold text-emerald-400">
                {activeTier === "championship" ? "£100,000" : "£350,000"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-pitch-800/50">
              <span className="text-pitch-400">Salary Cap</span>
              <span className="font-semibold text-sky-400">
                {activeTier === "championship" ? "£1,000,000 / yr" : "£2,100,000 / yr"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-pitch-400">Board Expectation</span>
              <span className="font-semibold text-amber-300">
                {activeTier === "championship"
                  ? (currentClubRep === 3 ? "Promotion Favourites" : "Playoff Contenders")
                  : (currentClubRep >= 4 ? "Championship Contenders" : "Top 6 Playoff Spot")}
              </span>
            </div>
          </div>

          <div className="mb-5">
            <label htmlFor="manager-name-input" className="block text-xs font-semibold text-pitch-300 mb-1.5">
              Manager Name
            </label>
            <input
              id="manager-name-input"
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Your Name"
              className="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-3.5 py-2.5 text-sm text-white placeholder-pitch-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition-all"
          >
            Take Charge of {selectedClubName}
          </button>
        </div>
      </div>
    </div>
  );
}
