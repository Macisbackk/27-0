"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useManager } from "@/lib/manager/context";
import { ensureFixtureKeyMoments } from "@/lib/manager/match";
import { formatPositionShort } from "@/lib/manager/formatters";
import { synth } from "@/lib/sound/synth";
import { acquireScrollLock, releaseScrollLock } from "@/lib/ui/scroll-lock";
import type { ManagerKeyMoment, KeyMomentType } from "@/lib/manager/types";

function getMomentBadge(type: KeyMomentType) {
  switch (type) {
    case "TRY":
      return { icon: "🏉", label: "TRY", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    case "CONVERSION":
      return { icon: "🎯", label: "GOAL", color: "bg-sky-500/20 text-sky-300 border-sky-500/40" };
    case "MISSED_CONVERSION":
      return { icon: "❌", label: "MISSED", color: "bg-slate-700/40 text-slate-400 border-slate-600/40" };
    case "PENALTY_GOAL":
      return { icon: "🥅", label: "PENALTY", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" };
    case "DROP_GOAL":
      return { icon: "⚡", label: "DROP GOAL", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    case "SIN_BIN":
      return { icon: "🟨", label: "SIN BIN (10 MIN)", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" };
    case "RED_CARD":
      return { icon: "🟥", label: "RED CARD", color: "bg-rose-600/25 text-rose-300 border-rose-600/50" };
    case "INJURY":
      return { icon: "🩹", label: "INJURY", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
    case "TRY_SAVER":
      return { icon: "🛡️", label: "TRY SAVER", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
    case "FORTY_TWENTY":
      return { icon: "🚀", label: "40/20 KICK", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" };
    case "HALF_TIME":
      return { icon: "⏸️", label: "HALF TIME", color: "bg-slate-600/30 text-slate-300 border-slate-500/40" };
    case "GOLDEN_POINT":
      return { icon: "⏱️", label: "GOLDEN POINT", color: "bg-amber-500/25 text-amber-300 border-amber-500/50" };
    case "FULL_TIME":
      return { icon: "🏁", label: "FULL TIME", color: "bg-emerald-600/25 text-emerald-300 border-emerald-500/50" };
    default:
      return { icon: "⚡", label: "MOMENT", color: "bg-pitch-800 text-pitch-300 border-pitch-700" };
  }
}

function getMomentCardStyle(type: KeyMomentType) {
  switch (type) {
    case "TRY":
      return "border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 to-pitch-950 shadow-emerald-950/30";
    case "CONVERSION":
    case "PENALTY_GOAL":
      return "border-sky-500/35 bg-gradient-to-b from-sky-950/25 to-pitch-950 shadow-sky-950/20";
    case "DROP_GOAL":
    case "GOLDEN_POINT":
      return "border-amber-500/40 bg-gradient-to-b from-amber-950/30 to-pitch-950 shadow-amber-950/30";
    case "RED_CARD":
    case "INJURY":
      return "border-rose-500/45 bg-gradient-to-b from-rose-950/30 to-pitch-950 shadow-rose-950/30";
    case "SIN_BIN":
      return "border-yellow-500/45 bg-gradient-to-b from-yellow-950/30 to-pitch-950 shadow-yellow-950/30";
    case "TRY_SAVER":
    case "FORTY_TWENTY":
      return "border-cyan-500/40 bg-gradient-to-b from-cyan-950/25 to-pitch-950 shadow-cyan-950/20";
    case "FULL_TIME":
      return "border-emerald-400/50 bg-gradient-to-b from-emerald-950/40 to-pitch-950 shadow-emerald-950/40";
    default:
      return "border-pitch-800 bg-pitch-900/60";
  }
}

export function ManagerKeyMomentsModal() {
  const {
    state,
    activeKeyMomentsFixture,
    closeKeyMoments,
    setLastPlayedMatchReview,
  } = useManager();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState<"1x" | "2x">("1x");
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // Lock document scroll while modal is active
  useEffect(() => {
    if (!activeKeyMomentsFixture) return;
    const lockId = acquireScrollLock("manager-key-moments");
    return () => {
      releaseScrollLock(lockId);
    };
  }, [activeKeyMomentsFixture]);

  // Ensure moments exist
  const moments: ManagerKeyMoment[] = useMemo(() => {
    if (!activeKeyMomentsFixture) return [];
    return ensureFixtureKeyMoments(activeKeyMomentsFixture, state?.clubs);
  }, [activeKeyMomentsFixture, state?.clubs]);

  // Reset index when fixture changes
  useEffect(() => {
    setCurrentIdx(0);
    setIsPlaying(true);
  }, [activeKeyMomentsFixture?.id]);

  // Play audio sound for active moment
  const playSoundForMoment = (moment: ManagerKeyMoment | undefined) => {
    if (!moment || state?.settings?.soundEnabled === false) return;
    try {
      switch (moment.type) {
        case "TRY":
          synth.tryScored();
          break;
        case "CONVERSION":
        case "PENALTY_GOAL":
        case "DROP_GOAL":
          synth.conversion();
          break;
        case "MISSED_CONVERSION":
          synth.conversionMiss();
          break;
        case "HALF_TIME":
          synth.halfTime();
          break;
        case "FULL_TIME":
        case "GOLDEN_POINT":
          synth.positionComplete();
          break;
        case "SIN_BIN":
        case "RED_CARD":
          synth.select();
          break;
        default:
          synth.click();
          break;
      }
    } catch {
      // Audio fallback safe
    }
  };

  // Step forward
  const handleNext = () => {
    if (currentIdx < moments.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      playSoundForMoment(moments[nextIdx]);
    } else {
      setIsPlaying(false);
    }
  };

  // Step backward
  const handlePrev = () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      playSoundForMoment(moments[prevIdx]);
    }
  };

  // Jump to specific index
  const handleJumpToMoment = (idx: number) => {
    setCurrentIdx(idx);
    setIsPlaying(false);
    playSoundForMoment(moments[idx]);
  };

  // Jump straight to full-time
  const handleSkipToFullTime = () => {
    if (moments.length > 0) {
      const lastIdx = moments.length - 1;
      setCurrentIdx(lastIdx);
      setIsPlaying(false);
      playSoundForMoment(moments[lastIdx]);
    }
  };

  // Auto-play timer loop
  useEffect(() => {
    if (!isPlaying) {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }

    if (currentIdx >= moments.length - 1) {
      setIsPlaying(false);
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }

    const intervalMs = playSpeed === "2x" ? 1200 : 2500;
    autoPlayRef.current = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = prev + 1;
        if (next >= moments.length - 1) {
          setIsPlaying(false);
        }
        playSoundForMoment(moments[next]);
        return next;
      });
    }, intervalMs);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPlaying, currentIdx, moments.length, playSpeed]);

  if (!activeKeyMomentsFixture || !state || moments.length === 0) {
    return null;
  }

  const fixture = activeKeyMomentsFixture;
  const homeClub = state.clubs[fixture.homeClubId];
  const awayClub = state.clubs[fixture.awayClubId];
  const activeMoment = moments[currentIdx] || moments[0];
  const badgeInfo = getMomentBadge(activeMoment.type);
  const cardStyle = getMomentCardStyle(activeMoment.type);
  const isFullTime = currentIdx === moments.length - 1;

  // Progress percentage across match minutes
  const progressPercent = Math.min(100, Math.max(0, (activeMoment.minute / 80) * 100));

  const handleOpenFullReview = () => {
    closeKeyMoments();
    setLastPlayedMatchReview(fixture);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-pitch-700 bg-pitch-950 p-4 sm:p-6 shadow-2xl space-y-4 scrollbar-thin scrollbar-thumb-pitch-700">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-pitch-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              {fixture.roundName}
            </span>
            <span className="text-xs text-pitch-400 hidden sm:inline">
              Key Moments Matchcast
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-pitch-400">
              {currentIdx + 1} / {moments.length}
            </span>
            <button
              type="button"
              onClick={closeKeyMoments}
              className="text-pitch-400 hover:text-white text-base p-1 rounded-lg hover:bg-pitch-800 transition-colors"
              title="Close Key Moments"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dynamic Running Scoreboard */}
        <div className="rounded-2xl border border-pitch-800 bg-gradient-to-b from-pitch-900 to-pitch-950 p-4 shadow-lg">
          <div className="grid grid-cols-7 items-center gap-2">
            {/* Home Team */}
            <div className="col-span-3 flex items-center justify-end gap-3 text-right">
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-black text-white truncate">
                  {homeClub?.shortName || fixture.homeClubId}
                </span>
                <span className="text-[10px] text-pitch-400 uppercase hidden sm:block">
                  {homeClub?.name}
                </span>
              </div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shadow-md border border-white/20 shrink-0"
                style={{
                  backgroundColor: homeClub?.primaryColor || "#1E4D9B",
                  color: homeClub?.textColour || "#FFFFFF",
                }}
              >
                {homeClub?.shortName?.slice(0, 3) || "HOM"}
              </div>
            </div>

            {/* Scoreboard Clock & Points */}
            <div className="col-span-1 flex flex-col items-center justify-center px-1">
              {/* Minute badge */}
              <span className="rounded-full bg-pitch-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-pitch-800 mb-1">
                {activeMoment.minute}&apos;
              </span>

              {/* Running Score */}
              <div className="flex items-baseline gap-1 text-2xl sm:text-3xl font-black text-white tracking-tight">
                <span>{activeMoment.homeScoreAfter}</span>
                <span className="text-pitch-500 text-lg">-</span>
                <span>{activeMoment.awayScoreAfter}</span>
              </div>

              {/* Points delta badge */}
              {activeMoment.pointsAdded ? (
                <span className="text-[10px] font-bold text-emerald-400 animate-pulse mt-0.5">
                  +{activeMoment.pointsAdded} pts
                </span>
              ) : (
                <span className="text-[9px] text-pitch-500 uppercase mt-0.5">
                  {activeMoment.type === "HALF_TIME" ? "Break" : activeMoment.type === "FULL_TIME" ? "Final" : "Play"}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="col-span-3 flex items-center justify-start gap-3 text-left">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shadow-md border border-white/20 shrink-0"
                style={{
                  backgroundColor: awayClub?.primaryColor || "#D00000",
                  color: awayClub?.textColour || "#FFFFFF",
                }}
              >
                {awayClub?.shortName?.slice(0, 3) || "AWY"}
              </div>
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-black text-white truncate">
                  {awayClub?.shortName || fixture.awayClubId}
                </span>
                <span className="text-[10px] text-pitch-400 uppercase hidden sm:block">
                  {awayClub?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Clock progress bar */}
          <div className="mt-3 w-full bg-pitch-950 rounded-full h-1.5 overflow-hidden border border-pitch-800/80">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Feature Hero Card for Current Moment */}
        <div className={`rounded-2xl border p-4 sm:p-5 shadow-lg space-y-3 transition-all ${cardStyle}`}>
          {/* Top row: Minute, Badge, Team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black border ${badgeInfo.color}`}>
                <span>{badgeInfo.icon}</span>
                <span>{badgeInfo.label}</span>
              </span>
              <span className="text-xs font-mono font-bold text-pitch-400">
                {activeMoment.minute}&apos; Minute
              </span>
            </div>

            <span className="text-xs font-bold text-pitch-300">
              {activeMoment.clubName}
            </span>
          </div>

          {/* Headline */}
          <div>
            <h3 className="text-base sm:text-lg font-black text-white leading-tight">
              {activeMoment.headline || activeMoment.title}
            </h3>
          </div>

          {/* Commentary Body */}
          <div className="rounded-xl bg-pitch-950/70 border border-pitch-800/60 p-3 sm:p-3.5">
            <p className="text-xs sm:text-sm text-pitch-200 leading-relaxed italic">
              &ldquo;{activeMoment.description}&rdquo;
            </p>
          </div>

          {/* Player Involved Banner (if present) */}
          {activeMoment.playerName && (
            <div className="flex items-center justify-between pt-1 border-t border-pitch-800/50 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {activeMoment.playerPosition && (
                  <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300 shrink-0">
                    {formatPositionShort(activeMoment.playerPosition)}
                  </span>
                )}
                <span className="font-bold text-white truncate">
                  {activeMoment.playerName}
                </span>
                <span className="text-[11px] text-pitch-400">
                  ({activeMoment.clubName})
                </span>
              </div>

              {activeMoment.importance === "critical" && (
                <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black uppercase">
                  ⚡ Critical
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeline Strip (Pills for every moment) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-pitch-400 font-semibold px-1">
            <span>Match Timeline</span>
            <span>Click any event to inspect</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-pitch-700">
            {moments.map((m, idx) => {
              const isSelected = idx === currentIdx;
              const isHome = m.isHome;
              const badge = getMomentBadge(m.type);

              return (
                <button
                  key={m.id || idx}
                  type="button"
                  onClick={() => handleJumpToMoment(idx)}
                  className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all border ${
                    isSelected
                      ? "ring-2 ring-emerald-400 border-emerald-400 bg-pitch-800 text-white shadow-md scale-105"
                      : isHome
                      ? "border-pitch-700 bg-pitch-900/80 text-pitch-300 hover:border-pitch-600 hover:text-white"
                      : "border-pitch-800 bg-pitch-950/70 text-pitch-400 hover:border-pitch-700 hover:text-white"
                  }`}
                  title={`${m.minute}' ${m.title} - ${m.clubName}`}
                >
                  <span className="font-mono text-[10px] text-pitch-400">{m.minute}&apos;</span>
                  <span>{badge.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-pitch-800">
          {/* Navigation & Auto-Play Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIdx === 0}
              className="rounded-xl border border-pitch-700 bg-pitch-900 px-3 py-2 text-xs font-bold text-white hover:bg-pitch-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ◀ Prev
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shadow transition-all ${
                isPlaying
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              <span>{isPlaying ? "⏸ Pause" : "⏵ Auto-Play"}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIdx >= moments.length - 1}
              className="rounded-xl border border-pitch-700 bg-pitch-900 px-3 py-2 text-xs font-bold text-white hover:bg-pitch-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next ▶
            </button>

            {/* Speed Toggle */}
            <button
              type="button"
              onClick={() => setPlaySpeed(playSpeed === "1x" ? "2x" : "1x")}
              className="rounded-xl border border-pitch-800 bg-pitch-950 px-2.5 py-2 text-[11px] font-mono font-bold text-pitch-300 hover:text-white"
              title="Toggle Auto-Play Speed"
            >
              {playSpeed}
            </button>
          </div>

          {/* Action Buttons: Skip to Result or Full Review */}
          <div className="flex items-center gap-2">
            {!isFullTime && (
              <button
                type="button"
                onClick={handleSkipToFullTime}
                className="rounded-xl border border-pitch-700 bg-pitch-900/80 px-3 py-2 text-xs font-semibold text-pitch-300 hover:text-white transition-all"
              >
                ⏭ Skip to Full Time
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenFullReview}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-black text-slate-950 shadow hover:brightness-110 active:scale-95 transition-all"
            >
              📊 Match Ratings &amp; Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
