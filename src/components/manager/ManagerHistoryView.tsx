"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { formatPositionShort } from "@/lib/manager";
import type { SeasonHistoryRecord } from "@/lib/manager/types";

export function ManagerHistoryView() {
  const { state } = useManager();

  if (!state) return null;

  const currentSeason = state.calendar.currentSeason;
  const history = state.seasonHistory || [];
  const userClubId = state.manager.clubId;
  const userClub = state.clubs[userClubId];
  const manager = state.manager;

  // Active season filter: default to most recent archived season, or "current", or "roll_of_honour"
  const [selectedView, setSelectedView] = useState<string>(
    history.length > 0 ? String(history[history.length - 1].season) : "current"
  );
  const [selectedTableLeague, setSelectedTableLeague] = useState<"super-league" | "championship">("super-league");

  const selectedRecord: SeasonHistoryRecord | undefined = history.find(
    (h) => String(h.season) === selectedView
  );

  // Calculate manager career totals
  const totalSeasonsCompleted = history.length;
  const managerTrophies = manager.trophiesWon || [];

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-2xl font-black text-white">History</h2>
        <p className="hidden sm:block text-xs text-pitch-400">
          Permanent historical record of domestic champions, silverware, league tables, awards, and your club&apos;s honours.
        </p>
      </div>

      {/* Manager Career & Trophy Cabinet Banner */}
      <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pitch-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              Head Coach Profile
            </span>
            <h3 className="text-lg font-black text-white">
              {manager.name} — {userClub?.name}
            </h3>
            <p className="text-xs text-pitch-400">
              Appointed Season {manager.appointedSeason} · Active in Season {currentSeason} ({currentSeason - manager.appointedSeason + 1} yrs)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-pitch-950 px-3.5 py-1.5 border border-pitch-800 text-center">
              <span className="text-[10px] text-pitch-400 block uppercase">Seasons Archived</span>
              <span className="text-base font-black text-white">{totalSeasonsCompleted}</span>
            </div>
            <div className="rounded-xl bg-pitch-950 px-3.5 py-1.5 border border-pitch-800 text-center">
              <span className="text-[10px] text-pitch-400 block uppercase">Trophies Won</span>
              <span className="text-base font-black text-amber-400">{managerTrophies.length}</span>
            </div>
          </div>
        </div>

        {/* Trophy Cabinet Pill Grid */}
        <div>
          <span className="text-xs font-bold text-pitch-300 block mb-2">
            🏆 Manager Trophy Cabinet
          </span>
          {managerTrophies.length === 0 ? (
            <p className="text-xs text-pitch-500 italic">
              No trophies won yet. Guide your club to silverware in Super League, Championship, or the Challenge Cup!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {managerTrophies.map((t, idx) => (
                <div
                  key={`${t.season}_${t.trophy}_${idx}`}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-sm"
                >
                  <span>🏆</span>
                  <span>{t.trophy}</span>
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200 border border-amber-500/30">
                    {t.season}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Season Navigation Rail */}
      <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
        {history.map((record) => {
          const isSelected = selectedView === String(record.season);
          return (
            <button
              key={record.season}
              type="button"
              onClick={() => setSelectedView(String(record.season))}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                isSelected
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
              }`}
            >
              Season {record.season}
            </button>
          );
        })}

        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedView("roll_of_honour")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              selectedView === "roll_of_honour"
                ? "bg-amber-600 text-white shadow"
                : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
            }`}
          >
            📜 All-Time Roll of Honour
          </button>
        )}

        <button
          type="button"
          onClick={() => setSelectedView("current")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
            selectedView === "current"
              ? "bg-emerald-600 text-white shadow"
              : "bg-pitch-900 text-pitch-400 hover:text-white border border-pitch-800"
          }`}
        >
          Season {currentSeason} (In Progress)
        </button>
      </div>

      {/* VIEW 1: Selected Archived Season Record */}
      {selectedRecord && selectedView !== "roll_of_honour" && selectedView !== "current" && (
        <div className="space-y-6">
          {/* User Club Season Review Banner */}
          <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-pitch-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Club Season Review
                </span>
                <h3 className="text-xl font-black text-white">
                  {selectedRecord.userClub.clubName} — Season {selectedRecord.season}
                </h3>
                <p className="text-xs text-pitch-400">
                  {selectedRecord.userClub.competitionName} · Finished Position #{selectedRecord.userClub.finishPosition} of {selectedRecord.userClub.totalClubs}
                </p>
              </div>

              {selectedRecord.userClub.trophiesWon.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecord.userClub.trophiesWon.map((trophy, i) => (
                    <span
                      key={i}
                      className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300"
                    >
                      🏆 {trophy}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Record Statistics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
              <div className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-center">
                <span className="block text-pitch-400 text-[10px] uppercase">Played</span>
                <span className="text-lg font-black text-white">{selectedRecord.userClub.played}</span>
              </div>
              <div className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-center">
                <span className="block text-pitch-400 text-[10px] uppercase">Record (W-D-L)</span>
                <span className="text-sm font-bold text-white">
                  {selectedRecord.userClub.won}-{selectedRecord.userClub.drawn}-{selectedRecord.userClub.lost}
                </span>
              </div>
              <div className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-center">
                <span className="block text-pitch-400 text-[10px] uppercase">League Points</span>
                <span className="text-lg font-black text-emerald-400">{selectedRecord.userClub.points}</span>
              </div>
              <div className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-center">
                <span className="block text-pitch-400 text-[10px] uppercase">Points Diff</span>
                <span className={`text-lg font-black ${selectedRecord.userClub.pointsDifference >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {selectedRecord.userClub.pointsDifference > 0 ? `+${selectedRecord.userClub.pointsDifference}` : selectedRecord.userClub.pointsDifference}
                </span>
              </div>
              <div className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-center">
                <span className="block text-pitch-400 text-[10px] uppercase">Top Scorer</span>
                <span className="text-xs font-bold text-white truncate block">
                  {selectedRecord.userClub.topScorer ? `${selectedRecord.userClub.topScorer.name} (${selectedRecord.userClub.topScorer.tries}t)` : "—"}
                </span>
              </div>
              <div className="rounded-xl bg-pitch-950 p-2.5 border border-pitch-800 text-center">
                <span className="block text-pitch-400 text-[10px] uppercase">Board Rating</span>
                <span className="text-lg font-black text-emerald-400">
                  {selectedRecord.userClub.boardConfidence}%
                </span>
              </div>
            </div>
          </div>

          {/* Silverware & Major Honours Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Super League Champions */}
            <div className="rounded-2xl border border-amber-500/40 bg-pitch-900 p-4 text-center space-y-1.5 shadow">
              <span className="text-3xl">🏆</span>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                Super League Champions
              </span>
              <h4 className="text-base font-black text-white">{selectedRecord.superLeagueChampion}</h4>
              {selectedRecord.superLeagueGrandFinalScore && (
                <p className="text-[11px] text-pitch-400">
                  Grand Final: {selectedRecord.superLeagueGrandFinalScore}{" "}
                  {selectedRecord.superLeagueRunnerUp ? `vs ${selectedRecord.superLeagueRunnerUp}` : ""}
                </p>
              )}
            </div>

            {/* League Leaders Shield */}
            <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4 text-center space-y-1.5 shadow">
              <span className="text-3xl">🛡️</span>
              <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block">
                League Leaders&apos; Shield
              </span>
              <h4 className="text-base font-black text-white">
                {selectedRecord.leagueLeadersShieldWinner || selectedRecord.superLeagueChampion}
              </h4>
              <p className="text-[11px] text-pitch-400">Regular Season 1st Place</p>
            </div>

            {/* Championship Champions */}
            <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4 text-center space-y-1.5 shadow">
              <span className="text-3xl">🎖️</span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                Championship Champions
              </span>
              <h4 className="text-base font-black text-white">{selectedRecord.championshipChampion}</h4>
              <p className="text-[11px] text-pitch-400">Automatically Promoted to Super League</p>
            </div>

            {/* Challenge Cup */}
            <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-4 text-center space-y-1.5 shadow">
              <span className="text-3xl">🏉</span>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                Betfred Challenge Cup
              </span>
              <h4 className="text-base font-black text-white">
                {selectedRecord.challengeCupWinner || "Not contested"}
              </h4>
              {selectedRecord.challengeCupFinalScore && (
                <p className="text-[11px] text-pitch-400">
                  Wembley Final: {selectedRecord.challengeCupFinalScore}{" "}
                  {selectedRecord.challengeCupRunnerUp ? `vs ${selectedRecord.challengeCupRunnerUp}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* The Million Pound Game Banner (if played) */}
          {selectedRecord.millionPoundGame && (
            <div className="rounded-2xl border border-amber-500/40 bg-pitch-900 p-4 text-center space-y-2 shadow">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                💰 The Million Pound Game (Promotion / Relegation Playoff)
              </span>
              <div className="flex items-center justify-center gap-3 sm:gap-6 font-black text-base sm:text-lg text-white">
                <div className="text-right min-w-0 max-w-[150px] sm:max-w-[200px]">
                  <span className="block text-sm sm:text-base text-white font-extrabold truncate">
                    {selectedRecord.millionPoundGame.superLeagueTeam}
                  </span>
                  <span className="text-[10px] text-pitch-400 font-semibold uppercase tracking-wider block">
                    Super League
                  </span>
                </div>
                <span className="rounded-xl bg-amber-500/20 px-3.5 py-1.5 font-mono text-base sm:text-lg text-amber-300 border border-amber-500/30 shrink-0 font-bold shadow-sm">
                  {selectedRecord.millionPoundGame.score}
                </span>
                <div className="text-left min-w-0 max-w-[150px] sm:max-w-[200px]">
                  <span className="block text-sm sm:text-base text-white font-extrabold truncate">
                    {selectedRecord.millionPoundGame.championshipTeam}
                  </span>
                  <span className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider block">
                    Championship
                  </span>
                </div>
              </div>
              <p className="text-xs font-semibold text-pitch-300">
                {selectedRecord.millionPoundGame.superLeagueSurvived ? (
                  <span className="text-emerald-400">
                    🛡️ {selectedRecord.millionPoundGame.superLeagueTeam} defended their Super League status!
                  </span>
                ) : (
                  <span className="text-amber-400">
                    ⚡ {selectedRecord.millionPoundGame.championshipTeam} earned promotion to Super League!
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Promotion & Relegation Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                ▲ Promoted to Super League
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedRecord.promotedClubs.map((clubName, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900/80 px-2.5 py-1 text-xs font-bold text-emerald-200 border border-emerald-700/60"
                  >
                    <span>{clubName}</span>
                    <span className="text-[10px] font-semibold text-emerald-300 opacity-80">
                      {idx === 0 ? "(Automatic)" : "(Million Pound Game)"}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                ▼ Relegated to Championship
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedRecord.relegatedClubs.map((clubName, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-900/80 px-2.5 py-1 text-xs font-bold text-rose-200 border border-rose-700/60"
                  >
                    <span>{clubName}</span>
                    <span className="text-[10px] font-semibold text-rose-300 opacity-80">
                      {idx === 0 ? "(Automatic)" : "(Million Pound Game)"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Individual Season Honours */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-pitch-400 uppercase tracking-wider">
              Individual Season Accolades
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Man of Steel */}
              <div className="rounded-xl border border-amber-500/30 bg-pitch-900 p-3.5 text-center space-y-1">
                <span className="text-2xl">⭐</span>
                <span className="text-[10px] font-bold uppercase text-amber-400 block tracking-wider">
                  Man of Steel (SL POTY)
                </span>
                {selectedRecord.manOfSteel ? (
                  <>
                    <h5 className="font-bold text-white text-sm truncate">{selectedRecord.manOfSteel.name}</h5>
                    <p className="text-[11px] text-pitch-400 truncate">
                      {selectedRecord.manOfSteel.clubName} · <span className="text-amber-300 font-semibold">{selectedRecord.manOfSteel.motm}</span> MOTMs
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-pitch-500 italic">No winner recorded</p>
                )}
              </div>

              {/* Super League Top Try Scorer */}
              <div className="rounded-xl border border-emerald-500/30 bg-pitch-900 p-3.5 text-center space-y-1">
                <span className="text-2xl">⚡</span>
                <span className="text-[10px] font-bold uppercase text-emerald-400 block tracking-wider">
                  SL Top Try Scorer
                </span>
                {selectedRecord.topTryScorer ? (
                  <>
                    <h5 className="font-bold text-white text-sm truncate">{selectedRecord.topTryScorer.name}</h5>
                    <p className="text-[11px] text-pitch-400 truncate">
                      {selectedRecord.topTryScorer.clubName} · <span className="text-emerald-300 font-semibold">{selectedRecord.topTryScorer.tries}</span> Tries
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-pitch-500 italic">No winner recorded</p>
                )}
              </div>

              {/* Championship POTY */}
              <div className="rounded-xl border border-sky-500/30 bg-pitch-900 p-3.5 text-center space-y-1">
                <span className="text-2xl">🎖️</span>
                <span className="text-[10px] font-bold uppercase text-sky-400 block tracking-wider">
                  Championship POTY
                </span>
                {selectedRecord.championshipPlayerOfYear ? (
                  <>
                    <h5 className="font-bold text-white text-sm truncate">{selectedRecord.championshipPlayerOfYear.name}</h5>
                    <p className="text-[11px] text-pitch-400 truncate">
                      {selectedRecord.championshipPlayerOfYear.clubName} · <span className="text-sky-300 font-semibold">{selectedRecord.championshipPlayerOfYear.motm}</span> MOTMs
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-pitch-500 italic">No winner recorded</p>
                )}
              </div>

              {/* Championship Top Try Scorer */}
              <div className="rounded-xl border border-emerald-500/30 bg-pitch-900 p-3.5 text-center space-y-1">
                <span className="text-2xl">⚡</span>
                <span className="text-[10px] font-bold uppercase text-emerald-400 block tracking-wider">
                  Champ Top Try Scorer
                </span>
                {selectedRecord.championshipTopTryScorer ? (
                  <>
                    <h5 className="font-bold text-white text-sm truncate">{selectedRecord.championshipTopTryScorer.name}</h5>
                    <p className="text-[11px] text-pitch-400 truncate">
                      {selectedRecord.championshipTopTryScorer.clubName} · <span className="text-emerald-300 font-semibold">{selectedRecord.championshipTopTryScorer.tries}</span> Tries
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-pitch-500 italic">No winner recorded</p>
                )}
              </div>
            </div>
          </div>

          {/* League Tables Snapshot */}
          <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pitch-800">
              <div>
                <h3 className="font-bold text-sm text-white">Archived League Standings (Season {selectedRecord.season})</h3>
                <p className="text-xs text-pitch-400">Official regular season tables snapshot.</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedTableLeague("super-league")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedTableLeague === "super-league"
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-pitch-950 text-pitch-400 hover:text-white border border-pitch-800"
                  }`}
                >
                  Super League
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTableLeague("championship")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedTableLeague === "championship"
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-pitch-950 text-pitch-400 hover:text-white border border-pitch-800"
                  }`}
                >
                  Championship
                </button>
              </div>
            </div>

            {/* Standings Table */}
            <div className="overflow-x-auto rounded-xl border border-pitch-800 bg-pitch-950/80 shadow">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-pitch-800 bg-pitch-950 text-pitch-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Pos</th>
                    <th className="py-2.5 px-3">Club</th>
                    <th className="py-2.5 px-2 text-center">P</th>
                    <th className="py-2.5 px-2 text-center">W</th>
                    <th className="py-2.5 px-2 text-center">D</th>
                    <th className="py-2.5 px-2 text-center">L</th>
                    <th className="py-2.5 px-2 text-center">PF</th>
                    <th className="py-2.5 px-2 text-center">PA</th>
                    <th className="py-2.5 px-2 text-center">Diff</th>
                    <th className="py-2.5 px-3 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pitch-800/50 text-pitch-200">
                  {(selectedTableLeague === "super-league"
                    ? selectedRecord.tables.superLeague
                    : selectedRecord.tables.championship
                  ).map((row) => {
                    const isUserClub = row.clubId === userClubId;
                    const isPlayoffSpot = selectedTableLeague === "super-league" && row.position <= 6;
                    const isPromotionSpot = selectedTableLeague === "championship" && row.position === 1;
                    const isRelegationSpot = selectedTableLeague === "super-league" && row.position === 14;
                    const isMpgSpot = selectedTableLeague === "super-league" && row.position === 13;

                    return (
                      <tr
                        key={row.clubId}
                        className={`hover:bg-pitch-800/40 transition-colors ${
                          isUserClub ? "bg-emerald-950/40 font-bold" : ""
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block w-6 rounded text-center text-xs font-bold ${
                              row.position === 1
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : isPlayoffSpot || isPromotionSpot
                                ? "bg-emerald-500/20 text-emerald-300"
                                : isRelegationSpot
                                ? "bg-rose-500/20 text-rose-300"
                                : isMpgSpot
                                ? "bg-amber-500/20 text-amber-300"
                                : "text-pitch-400"
                            }`}
                          >
                            {row.position}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>{row.clubName}</span>
                          {isUserClub && (
                            <span className="rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-300 border border-emerald-500/40">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-pitch-400">{row.played}</td>
                        <td className="py-2 px-2 text-center text-pitch-300">{row.won}</td>
                        <td className="py-2 px-2 text-center text-pitch-400">{row.drawn}</td>
                        <td className="py-2 px-2 text-center text-pitch-400">{row.lost}</td>
                        <td className="py-2 px-2 text-center text-pitch-400">{row.pointsFor}</td>
                        <td className="py-2 px-2 text-center text-pitch-400">{row.pointsAgainst}</td>
                        <td
                          className={`py-2 px-2 text-center font-semibold ${
                            row.pointsDifference > 0
                              ? "text-emerald-400"
                              : row.pointsDifference < 0
                              ? "text-rose-400"
                              : "text-pitch-400"
                          }`}
                        >
                          {row.pointsDifference > 0 ? `+${row.pointsDifference}` : row.pointsDifference}
                        </td>
                        <td className="py-2 px-3 text-center text-sm font-black text-white">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: All-Time Roll of Honour Timeline */}
      {selectedView === "roll_of_honour" && (
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-lg space-y-4">
          <div className="pb-3 border-b border-pitch-800">
            <h3 className="text-base font-bold text-white">All-Time Roll of Honour & Silverware Timeline</h3>
            <p className="text-xs text-pitch-400">
              Chronological ledger of domestic titles and cup champions across every completed season.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-pitch-800 bg-pitch-950 text-pitch-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Season</th>
                  <th className="py-2.5 px-3">Super League Champion</th>
                  <th className="py-2.5 px-3">Championship Champion</th>
                  <th className="py-2.5 px-3">Challenge Cup</th>
                  <th className="py-2.5 px-3">Man of Steel (SL)</th>
                  <th className="py-2.5 px-3">Championship POTY</th>
                  <th className="py-2.5 px-3 text-right">Your Club Finish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-800/40 text-pitch-200">
                {history.map((record) => (
                  <tr key={record.season} className="hover:bg-pitch-800/30 transition-colors">
                    <td className="py-3 px-3 font-black text-amber-400">
                      Season {record.season}
                    </td>
                    <td className="py-3 px-3 font-bold text-white">
                      🏆 {record.superLeagueChampion}
                    </td>
                    <td className="py-3 px-3 text-pitch-300">
                      🎖️ {record.championshipChampion}
                    </td>
                    <td className="py-3 px-3 text-pitch-300">
                      {record.challengeCupWinner ? `🏉 ${record.challengeCupWinner}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-pitch-300">
                      {record.manOfSteel ? `⭐ ${record.manOfSteel.name} (${record.manOfSteel.clubName})` : "—"}
                    </td>
                    <td className="py-3 px-3 text-pitch-300">
                      {record.championshipPlayerOfYear ? `🎖️ ${record.championshipPlayerOfYear.name} (${record.championshipPlayerOfYear.clubName})` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-emerald-400">
                        #{record.userClub.finishPosition} ({record.userClub.competitionName.replace("Betfred ", "")})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Current Campaign (Season In Progress) */}
      {selectedView === "current" && (
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-pitch-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Live Campaign
              </span>
              <h3 className="text-xl font-black text-white">
                Season {currentSeason} — {userClub?.name}
              </h3>
              <p className="text-xs text-pitch-400">
                Week {state.calendar.currentWeek} of {state.calendar.totalWeeks} · Phase: {state.calendar.phase.replace("_", " ").toUpperCase()}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-pitch-800 bg-pitch-950/70 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">ℹ️</span>
              <span className="font-bold text-white text-sm">Season Archive in Progress</span>
            </div>
            <p className="text-pitch-300 leading-relaxed text-[11px]">
              Season {currentSeason} is currently underway. When all domestic fixtures and playoffs conclude at Week 32,
              the season will be officially rolled over. Full final standings, individual honours (Man of Steel, Top Scorer),
              cup results, and your club&apos;s achievements will be permanently archived here for the rest of your save.
            </p>
          </div>

          {/* Quick Stats of Current Season */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-pitch-950 p-3 border border-pitch-800 text-center">
              <span className="block text-pitch-400 text-[10px] uppercase">Division</span>
              <span className="text-sm font-bold text-white">
                {userClub?.competitionId === "super-league" ? "Super League" : "Championship"}
              </span>
            </div>
            <div className="rounded-xl bg-pitch-950 p-3 border border-pitch-800 text-center">
              <span className="block text-pitch-400 text-[10px] uppercase">Board Confidence</span>
              <span className="text-sm font-bold text-emerald-400">{userClub?.boardConfidence}%</span>
            </div>
            <div className="rounded-xl bg-pitch-950 p-3 border border-pitch-800 text-center">
              <span className="block text-pitch-400 text-[10px] uppercase">Club Treasury</span>
              <span className="text-sm font-bold text-emerald-400">
                £{userClub?.finances.balance.toLocaleString()}
              </span>
            </div>
            <div className="rounded-xl bg-pitch-950 p-3 border border-pitch-800 text-center">
              <span className="block text-pitch-400 text-[10px] uppercase">Squad Size</span>
              <span className="text-sm font-bold text-white">
                {Object.values(state.players).filter((p) => p.clubId === userClubId).length} players
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
