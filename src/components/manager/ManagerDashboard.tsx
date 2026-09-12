"use client";

import React from "react";
import { useManager } from "@/lib/manager/context";
import { calculateSalaryCapUsage } from "@/lib/manager/contracts";
import { sortStandings } from "@/lib/manager/competitions";

export function ManagerDashboard() {
  const { state, setActiveTab, advanceCurrentWeek, isAdvancing } = useManager();

  if (!state) return null;

  const userClubId = state.manager.clubId;
  const club = state.clubs[userClubId];
  const cap = calculateSalaryCapUsage(state, userClubId);

  // Find next fixture for the manager's club
  const compId = club?.competitionId || "super-league";
  const comp = state.competitions[compId];
  const nextFixture =
    state.competitions["friendlies"]?.fixtures.find(
      (f) => !f.isPlayed && (f.homeClubId === userClubId || f.awayClubId === userClubId)
    ) ||
    state.competitions["challenge-cup"]?.fixtures.find(
      (f) => !f.isPlayed && (f.homeClubId === userClubId || f.awayClubId === userClubId)
    ) ||
    comp?.fixtures.find(
      (f) => !f.isPlayed && (f.homeClubId === userClubId || f.awayClubId === userClubId)
    );

  const opponentClubId = nextFixture
    ? nextFixture.homeClubId === userClubId
      ? nextFixture.awayClubId
      : nextFixture.homeClubId
    : null;
  const opponentClub = opponentClubId ? state.clubs[opponentClubId] : null;

  // Standings position
  const sorted = comp ? sortStandings(comp.standings) : [];
  const currentRank = sorted.findIndex((s) => s.clubId === userClubId) + 1;
  const userStanding = sorted.find((s) => s.clubId === userClubId);

  // Squad availability counts
  const allClubPlayers = Object.values(state.players).filter((p) => p.clubId === userClubId);
  const injuredPlayers = allClubPlayers.filter((p) => p.injury !== null);
  const suspendedPlayers = allClubPlayers.filter((p) => p.suspension !== null);

  // Recent messages
  const recentInbox = state.inbox.messages.slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Banner: Next Match Highlight */}
      <section className="relative overflow-hidden rounded-2xl border border-pitch-700 bg-gradient-to-br from-pitch-900 to-pitch-950 p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              {nextFixture ? nextFixture.roundName : "Season Complete"}
            </span>
            <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">
              {nextFixture && opponentClub ? (
                <>
                  {nextFixture.homeClubId === userClubId ? "vs" : "@"} {opponentClub.name}
                </>
              ) : (
                "End of Season"
              )}
            </h2>
            <p className="text-xs sm:text-sm text-pitch-400 mt-0.5">
              {nextFixture
                ? `${nextFixture.competitionId === "friendlies" ? "Pre-Season Friendly" : (nextFixture.competitionId === "challenge-cup" ? "Challenge Cup" : (club?.competitionId === "super-league" ? "Super League" : "Championship"))} · Week ${nextFixture.week}`
                : "All fixtures complete for this campaign."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("tactics")}
              className="rounded-xl border border-pitch-700 bg-pitch-900/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-pitch-800 transition-colors"
            >
              Matchday Tactics
            </button>
            <button
              type="button"
              disabled={isAdvancing}
              onClick={() => advanceCurrentWeek()}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              {isAdvancing ? "Simulating..." : "Play / Advance"}
            </button>
          </div>
        </div>
      </section>

      {/* Grid: 3 Main Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Card 1: League Standing Mini */}
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">League Position</h3>
            <button
              type="button"
              onClick={() => setActiveTab("league")}
              className="text-xs text-emerald-400 hover:underline"
            >
              View Table →
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">
              {currentRank > 0 ? `#${currentRank}` : "-"}
            </span>
            <span className="text-xs text-pitch-400">
              in {club?.competitionId === "super-league" ? "Super League" : "Championship"}
            </span>
          </div>

          {userStanding ? (
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
                <span className="block text-pitch-400">P</span>
                <span className="font-bold text-white">{userStanding.played}</span>
              </div>
              <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
                <span className="block text-pitch-400">W</span>
                <span className="font-bold text-emerald-400">{userStanding.won}</span>
              </div>
              <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
                <span className="block text-pitch-400">Diff</span>
                <span className={`font-bold ${userStanding.pointsDifference >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {userStanding.pointsDifference > 0 ? `+${userStanding.pointsDifference}` : userStanding.pointsDifference}
                </span>
              </div>
              <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
                <span className="block text-pitch-400">Pts</span>
                <span className="font-bold text-sky-400 text-sm">{userStanding.points}</span>
              </div>
            </div>
          ) : null}

          {/* Form Guide */}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-pitch-400">
            <span>Form:</span>
            {userStanding?.form.length ? (
              userStanding.form.map((res, i) => (
                <span
                  key={i}
                  className={`flex h-5 w-5 items-center justify-center rounded font-bold text-[10px] text-white ${
                    res === "W" ? "bg-emerald-600" : (res === "D" ? "bg-amber-600" : "bg-rose-600")
                  }`}
                >
                  {res}
                </span>
              ))
            ) : (
              <span className="text-pitch-500 italic">No matches yet</span>
            )}
          </div>
        </div>

        {/* Card 2: Squad Status & Health */}
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">Squad Status</h3>
            <button
              type="button"
              onClick={() => setActiveTab("squad")}
              className="text-xs text-emerald-400 hover:underline"
            >
              Manage Squad →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
              <span className="block text-pitch-400">Total</span>
              <span className="font-bold text-white text-base">{allClubPlayers.length}</span>
            </div>
            <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
              <span className="block text-pitch-400">Injured</span>
              <span className={`font-bold text-base ${injuredPlayers.length > 0 ? "text-rose-400" : "text-pitch-400"}`}>
                {injuredPlayers.length}
              </span>
            </div>
            <div className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
              <span className="block text-pitch-400">Suspended</span>
              <span className={`font-bold text-base ${suspendedPlayers.length > 0 ? "text-amber-400" : "text-pitch-400"}`}>
                {suspendedPlayers.length}
              </span>
            </div>
          </div>

          {injuredPlayers.length > 0 ? (
            <div className="space-y-1.5 max-h-24 overflow-y-auto text-xs pr-1">
              {injuredPlayers.slice(0, 2).map((p) => (
                <div key={p.id} className="flex justify-between items-center rounded bg-rose-950/40 px-2 py-1 text-rose-300 border border-rose-900/40">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-[11px] shrink-0">{p.injury?.weeksRemaining}wks ({p.injury?.type})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-400/90 italic mt-2">Squad is healthy with zero injuries.</p>
          )}
        </div>

        {/* Card 3: Board Confidence & Objectives */}
        <div className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">Board Confidence</h3>
            <span className="font-bold text-emerald-400 text-sm">{club?.boardConfidence}%</span>
          </div>

          {/* Meter Bar */}
          <div className="h-2.5 w-full rounded-full bg-pitch-950 overflow-hidden mb-3 border border-pitch-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (club?.boardConfidence || 75) >= 70
                  ? "bg-emerald-500"
                  : (club?.boardConfidence || 75) >= 45
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${club?.boardConfidence || 75}%` }}
            />
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="text-pitch-400 font-semibold block mb-1">Primary Objective:</span>
            {club?.boardObjectives.slice(0, 2).map((obj) => (
              <div key={obj.id} className="rounded-lg bg-pitch-950/60 p-2 border border-pitch-800/40">
                <span className="font-medium text-white block">{obj.title}</span>
                <span className="text-[11px] text-pitch-400">{obj.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Inbox Messages */}
      <section className="rounded-2xl border border-pitch-800 bg-pitch-900/80 p-5 shadow">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-pitch-800">
          <h3 className="font-bold text-sm text-white">Recent Inbox News</h3>
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className="text-xs text-emerald-400 hover:underline"
          >
            Open Inbox ({state.inbox.unreadCount} unread) →
          </button>
        </div>

        <div className="divide-y divide-pitch-800/60">
          {recentInbox.length ? (
            recentInbox.map((msg) => (
              <div
                key={msg.id}
                onClick={() => setActiveTab("inbox")}
                className="flex items-center justify-between py-2.5 hover:bg-pitch-800/30 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    {!msg.isRead && (
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-white truncate">
                      {msg.subject}
                    </span>
                  </div>
                  <p className="text-xs text-pitch-400 truncate mt-0.5">{msg.body}</p>
                </div>
                <span className="text-[11px] text-pitch-500 shrink-0">{msg.dateStr}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-pitch-500 italic py-2">No messages in inbox.</p>
          )}
        </div>
      </section>
    </div>
  );
}
