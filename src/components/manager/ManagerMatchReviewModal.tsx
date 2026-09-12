"use client";

import React, { useState } from "react";
import { useManager } from "@/lib/manager/context";
import { formatPositionLabel, formatPositionShort, formatScoreEventType } from "@/lib/manager";
import type { ManagerFixture, ManagerClub, MatchPlayerPerformance } from "@/lib/manager/types";

function PlayerRatingRow({
  perf,
  jerseyNum,
  isMotm,
}: {
  perf: MatchPlayerPerformance;
  jerseyNum: number;
  isMotm: boolean;
}) {
  const posAbbr = jerseyNum > 13 ? "INT" : formatPositionShort(perf.position, jerseyNum - 1);

  return (
    <div
      className={`flex items-center justify-between py-1.5 px-3 text-xs transition-colors ${
        isMotm ? "bg-amber-500/10" : "hover:bg-pitch-800/30"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-mono font-bold text-pitch-400 w-5 text-center shrink-0">
          {jerseyNum}
        </span>
        <span className="rounded bg-pitch-800/80 px-1 py-0.5 text-[9px] font-bold text-pitch-300 shrink-0 w-7 text-center">
          {posAbbr}
        </span>
        <span className="font-medium text-white truncate">
          {perf.playerName}
        </span>
        {isMotm && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/40 shrink-0">
            ⭐ MOTM
          </span>
        )}
        {perf.injured && (
          <span className="text-[11px] shrink-0" title="Injured">
            🩹
          </span>
        )}
        {perf.tries > 0 && (
          <span className="text-emerald-400 font-bold text-[11px] shrink-0">
            {perf.tries === 1 ? "1T" : `${perf.tries}T`}
          </span>
        )}
        {perf.goals > 0 && (
          <span className="text-sky-400 font-bold text-[11px] shrink-0">
            {perf.goals === 1 ? "1G" : `${perf.goals}G`}
          </span>
        )}
        {perf.dropGoals > 0 && (
          <span className="text-amber-400 font-bold text-[11px] shrink-0">
            {perf.dropGoals === 1 ? "1DG" : `${perf.dropGoals}DG`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <span
          className={`font-black text-xs px-1.5 py-0.5 rounded ${
            perf.rating >= 8.0
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : perf.rating >= 7.0
              ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
              : perf.rating >= 6.0
              ? "bg-pitch-800 text-pitch-300 border border-pitch-700"
              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
          }`}
        >
          {perf.rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function TeamRatingsSection({
  club,
  role,
  performances,
  motmPlayerId,
  isUserClub,
}: {
  club?: ManagerClub;
  role: "Home" | "Away";
  performances: MatchPlayerPerformance[];
  motmPlayerId?: string;
  isUserClub?: boolean;
}) {
  const avgRating =
    performances.length > 0
      ? (
          performances.reduce((acc, p) => acc + p.rating, 0) /
          performances.length
        ).toFixed(1)
      : "0.0";

  const starting13 = performances.slice(0, 13);
  const interchanges = performances.slice(13);

  return (
    <div className="flex flex-col rounded-2xl border border-pitch-800 bg-pitch-900/70 overflow-hidden shadow">
      {/* Team Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-pitch-800 bg-pitch-950/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] shadow-sm shrink-0 border border-white/20"
            style={{
              backgroundColor: club?.primaryColor || "#1E4D9B",
              color: club?.textColour || "#FFFFFF",
            }}
          >
            {club?.abbreviation ||
              club?.shortName?.slice(0, 3).toUpperCase() ||
              (role === "Home" ? "HME" : "AWY")}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h5 className="font-bold text-xs text-white truncate">
                {club?.name || (role === "Home" ? "Home Team" : "Away Team")}
              </h5>
              {isUserClub && (
                <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 shrink-0">
                  You
                </span>
              )}
            </div>
            <span className="text-[10px] text-pitch-400 uppercase tracking-wider block">
              {role}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-pitch-400 uppercase font-semibold">
            Avg:
          </span>
          <span
            className={`text-xs font-black px-1.5 py-0.5 rounded ${
              Number(avgRating) >= 7.5
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : Number(avgRating) >= 6.8
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                : "bg-pitch-800 text-pitch-300 border border-pitch-700"
            }`}
          >
            {avgRating}
          </span>
        </div>
      </div>

      {/* Players List */}
      <div className="divide-y divide-pitch-800/40 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-pitch-700">
        {starting13.length > 0 && (
          <div className="px-3 py-1 bg-pitch-950/40 text-[10px] font-bold uppercase tracking-wider text-pitch-400">
            Starting XIII
          </div>
        )}
        {starting13.map((perf, i) => (
          <PlayerRatingRow
            key={perf.playerId || i}
            perf={perf}
            jerseyNum={i + 1}
            isMotm={perf.playerId === motmPlayerId}
          />
        ))}

        {interchanges.length > 0 && (
          <div className="px-3 py-1 bg-pitch-950/40 text-[10px] font-bold uppercase tracking-wider text-pitch-400">
            Interchanges
          </div>
        )}
        {interchanges.map((perf, i) => (
          <PlayerRatingRow
            key={perf.playerId || i + 13}
            perf={perf}
            jerseyNum={i + 14}
            isMotm={perf.playerId === motmPlayerId}
          />
        ))}
      </div>
    </div>
  );
}

export function ManagerMatchReviewModal() {
  const { lastPlayedMatchReview, setLastPlayedMatchReview, state } = useManager();
  const [teamView, setTeamView] = useState<"both" | "home" | "away">("both");

  if (!lastPlayedMatchReview || !state) return null;

  const fixture: ManagerFixture = lastPlayedMatchReview;
  const homeClub = state.clubs[fixture.homeClubId];
  const awayClub = state.clubs[fixture.awayClubId];
  const userClubId = state.manager.clubId;

  const motmPlayer = fixture.manOfTheMatchPlayerId
    ? state.players[fixture.manOfTheMatchPlayerId]
    : null;

  let homePerformances = (fixture.playerPerformances || []).filter(
    (p) => p.clubId === fixture.homeClubId
  );
  let awayPerformances = (fixture.playerPerformances || []).filter(
    (p) => p.clubId === fixture.awayClubId
  );

  // Fallback if clubId was not explicitly set on player performances
  if (
    homePerformances.length === 0 &&
    awayPerformances.length === 0 &&
    (fixture.playerPerformances?.length || 0) > 0
  ) {
    const half = Math.ceil((fixture.playerPerformances?.length || 0) / 2);
    homePerformances = fixture.playerPerformances!.slice(0, half);
    awayPerformances = fixture.playerPerformances!.slice(half);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-pitch-700 bg-pitch-950 p-5 sm:p-7 shadow-2xl space-y-5 scrollbar-thin scrollbar-thumb-pitch-700">
        {/* Header Eyebrow */}
        <div className="flex items-center justify-between border-b border-pitch-800 pb-3">
          <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            {fixture.roundName} Review
          </span>
          <button
            type="button"
            onClick={() => setLastPlayedMatchReview(null)}
            className="text-pitch-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Scoreboard Hero Banner */}
        <div className="rounded-2xl border border-pitch-750 bg-gradient-to-b from-pitch-900 to-pitch-950 p-5 text-center shadow-lg">
          <div className="grid grid-cols-5 items-center gap-2">
            {/* Home Club */}
            <div className="col-span-2 flex flex-col items-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20 mb-2"
                style={{
                  backgroundColor: homeClub?.primaryColor || "#1E4D9B",
                  color: homeClub?.textColour || "#FFFFFF",
                }}
              >
                {homeClub?.abbreviation || "HME"}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">{homeClub?.name}</h3>
            </div>

            {/* Score */}
            <div className="col-span-1 flex flex-col items-center">
              <div className="flex items-center gap-2 text-3xl sm:text-4xl font-black text-white tracking-tight">
                <span className={fixture.homeScore! > fixture.awayScore! ? "text-emerald-400" : "text-white"}>
                  {fixture.homeScore}
                </span>
                <span className="text-pitch-600">-</span>
                <span className={fixture.awayScore! > fixture.homeScore! ? "text-emerald-400" : "text-white"}>
                  {fixture.awayScore}
                </span>
              </div>
              <span className="text-[11px] font-bold text-pitch-400 uppercase tracking-wider mt-1">
                Full Time
              </span>
            </div>

            {/* Away Club */}
            <div className="col-span-2 flex flex-col items-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border border-white/20 mb-2"
                style={{
                  backgroundColor: awayClub?.primaryColor || "#C8102E",
                  color: awayClub?.textColour || "#FFFFFF",
                }}
              >
                {awayClub?.abbreviation || "AWY"}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">{awayClub?.name}</h3>
            </div>
          </div>

          <p className="text-xs text-pitch-400 mt-4 border-t border-pitch-800/60 pt-2">
            {homeClub?.stadiumName} · Attendance: {fixture.attendance?.toLocaleString()}
          </p>
        </div>

        {/* Man of the Match */}
        {motmPlayer && (
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Man of the Match
                </span>
                <h4 className="text-sm font-black text-white">{motmPlayer.name}</h4>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-300">
              {formatPositionLabel(motmPlayer.position)} · {state.clubs[motmPlayer.clubId || ""]?.name}
            </span>
          </div>
        )}

        {/* Score Events Timeline */}
        {fixture.scoreEvents && fixture.scoreEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-pitch-400 uppercase tracking-wider">
              Scoring Timeline
            </h4>
            <div className="rounded-xl border border-pitch-800 bg-pitch-900/60 divide-y divide-pitch-800/40 max-h-48 overflow-y-auto">
              {fixture.scoreEvents.map((evt, idx) => {
                const isHome = evt.clubId === fixture.homeClubId;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2 px-3 text-xs ${
                      isHome ? "text-white" : "text-pitch-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-400">
                        {evt.minute}&apos;
                      </span>
                      <span className="font-bold text-emerald-400">{formatScoreEventType(evt.type)}</span>
                      <span>{evt.playerName}</span>
                    </div>
                    <span className="text-[11px] text-pitch-400 font-semibold">
                      {isHome ? homeClub?.shortName : awayClub?.shortName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player Performances (Separated by Team) */}
        {fixture.playerPerformances && fixture.playerPerformances.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-pitch-400 uppercase tracking-wider">
                Player Match Ratings
              </h4>

              {/* View Switcher Tabs */}
              <div className="inline-flex rounded-xl bg-pitch-900 p-1 border border-pitch-800 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTeamView("both")}
                  className={`rounded-lg px-3 py-1 font-bold transition-all ${
                    teamView === "both"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-pitch-400 hover:text-white"
                  }`}
                >
                  Both Teams
                </button>
                <button
                  type="button"
                  onClick={() => setTeamView("home")}
                  className={`rounded-lg px-3 py-1 font-bold transition-all ${
                    teamView === "home"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-pitch-400 hover:text-white"
                  }`}
                >
                  {homeClub?.shortName || "Home"}
                </button>
                <button
                  type="button"
                  onClick={() => setTeamView("away")}
                  className={`rounded-lg px-3 py-1 font-bold transition-all ${
                    teamView === "away"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-pitch-400 hover:text-white"
                  }`}
                >
                  {awayClub?.shortName || "Away"}
                </button>
              </div>
            </div>

            {/* Team Sections Display */}
            {teamView === "both" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamRatingsSection
                  club={homeClub}
                  role="Home"
                  performances={homePerformances}
                  motmPlayerId={fixture.manOfTheMatchPlayerId}
                  isUserClub={homeClub?.id === userClubId}
                />
                <TeamRatingsSection
                  club={awayClub}
                  role="Away"
                  performances={awayPerformances}
                  motmPlayerId={fixture.manOfTheMatchPlayerId}
                  isUserClub={awayClub?.id === userClubId}
                />
              </div>
            ) : teamView === "home" ? (
              <TeamRatingsSection
                club={homeClub}
                role="Home"
                performances={homePerformances}
                motmPlayerId={fixture.manOfTheMatchPlayerId}
                isUserClub={homeClub?.id === userClubId}
              />
            ) : (
              <TeamRatingsSection
                club={awayClub}
                role="Away"
                performances={awayPerformances}
                motmPlayerId={fixture.manOfTheMatchPlayerId}
                isUserClub={awayClub?.id === userClubId}
              />
            )}
          </div>
        )}

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => setLastPlayedMatchReview(null)}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-center text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition-all"
        >
          Return to Hub
        </button>
      </div>
    </div>
  );
}
