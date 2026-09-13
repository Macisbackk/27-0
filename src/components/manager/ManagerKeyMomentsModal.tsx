"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useManager } from "@/lib/manager/context";
import { ensureFixtureKeyMoments } from "@/lib/manager/match";
import { formatPositionShort } from "@/lib/manager/formatters";
import { synth } from "@/lib/sound/synth";
import { useScrollLock } from "@/hooks/useScrollLock";
import { uiLayerClass } from "@/lib/ui/layers";
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

function getMomentCardStyle(type: KeyMomentType | "KICK_OFF") {
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
    case "KICK_OFF":
      return "border-pitch-700 bg-gradient-to-b from-pitch-900/80 to-pitch-950";
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

  // -1 = kick-off (0', 0-0) before the first scored moment
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(true);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const moments: ManagerKeyMoment[] = useMemo(() => {
    if (!activeKeyMomentsFixture) return [];
    return ensureFixtureKeyMoments(activeKeyMomentsFixture, state?.clubs);
  }, [activeKeyMomentsFixture, state?.clubs]);

  const matchcastOpen = Boolean(activeKeyMomentsFixture) && moments.length > 0;
  useScrollLock(matchcastOpen, "manager-key-moments");

  useEffect(() => {
    if (activeKeyMomentsFixture && moments.length === 0) {
      closeKeyMoments();
    }
  }, [activeKeyMomentsFixture, moments.length, closeKeyMoments]);

  useEffect(() => {
    setCurrentIdx(-1);
    setIsPlaying(true);
  }, [activeKeyMomentsFixture?.id]);

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

  const handleSkipToFullTime = () => {
    if (moments.length > 0) {
      const lastIdx = moments.length - 1;
      setCurrentIdx(lastIdx);
      setIsPlaying(false);
      playSoundForMoment(moments[lastIdx]);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }

    if (currentIdx >= moments.length - 1 && moments.length > 0) {
      setIsPlaying(false);
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }

    autoPlayRef.current = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = prev + 1;
        if (next >= moments.length - 1) {
          setIsPlaying(false);
        }
        if (next >= 0 && next < moments.length) {
          playSoundForMoment(moments[next]);
        }
        return Math.min(next, moments.length - 1);
      });
    }, 2200);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPlaying, currentIdx, moments.length]);

  if (!activeKeyMomentsFixture || !state || moments.length === 0) {
    return null;
  }

  const fixture = activeKeyMomentsFixture;
  const homeClub = state.clubs[fixture.homeClubId];
  const awayClub = state.clubs[fixture.awayClubId];
  const isKickOff = currentIdx < 0;
  const activeMoment = isKickOff ? null : moments[currentIdx] || moments[0];
  const displayMinute = isKickOff ? 0 : activeMoment!.minute;
  const displayHome = isKickOff ? 0 : activeMoment!.homeScoreAfter;
  const displayAway = isKickOff ? 0 : activeMoment!.awayScoreAfter;
  const badgeInfo = isKickOff
    ? { icon: "🏟️", label: "KICK OFF", color: "bg-pitch-800 text-pitch-200 border-pitch-600" }
    : getMomentBadge(activeMoment!.type);
  const cardStyle = getMomentCardStyle(isKickOff ? "KICK_OFF" : activeMoment!.type);
  const isFullTime = !isKickOff && currentIdx === moments.length - 1;
  const progressPercent = Math.min(100, Math.max(0, (displayMinute / 80) * 100));

  const handleOpenFullReview = () => {
    closeKeyMoments();
    setLastPlayedMatchReview(fixture);
  };

  return (
    <div
      className={`fixed inset-0 ${uiLayerClass("modalBackdrop")} flex items-end justify-center overflow-hidden overscroll-none bg-black p-0 sm:items-center sm:p-5`}
      role="dialog"
      aria-modal="true"
      aria-label="Match"
    >
      <div className="flex w-full max-w-3xl max-h-[min(100dvh,100%)] flex-col overflow-hidden rounded-t-3xl border border-pitch-700 bg-pitch-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-2xl sm:max-h-[min(92dvh,100%)] sm:rounded-3xl sm:p-6 sm:pb-6">
        <div className="flex shrink-0 items-center justify-between border-b border-pitch-800 pb-2.5">
          <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider truncate max-w-[85%]">
            {fixture.roundName}
          </span>
          <button
            type="button"
            onClick={closeKeyMoments}
            className="text-pitch-400 hover:text-white text-base p-1 rounded-lg hover:bg-pitch-800 transition-colors shrink-0"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-2.5 shrink-0 rounded-2xl border border-pitch-800 bg-gradient-to-b from-pitch-900 to-pitch-950 p-3 sm:p-4 shadow-lg">
          <div className="grid grid-cols-7 items-center gap-1.5 sm:gap-2">
            <div className="col-span-3 flex items-center justify-end gap-2 sm:gap-3 text-right">
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-black text-white truncate">
                  {homeClub?.shortName || fixture.homeClubId}
                </span>
                <span className="text-[10px] text-pitch-400 uppercase hidden sm:block">
                  {homeClub?.name}
                </span>
              </div>
              <div
                className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-[10px] sm:text-sm shadow-md border border-white/20 shrink-0"
                style={{
                  backgroundColor: homeClub?.primaryColor || "#1E4D9B",
                  color: homeClub?.textColour || "#FFFFFF",
                }}
              >
                {homeClub?.abbreviation || homeClub?.shortName?.slice(0, 3) || "HOM"}
              </div>
            </div>

            <div className="col-span-1 flex flex-col items-center justify-center px-0.5">
              <span className="rounded-full bg-pitch-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-pitch-800 mb-1">
                {displayMinute}&apos;
              </span>
              <div className="flex items-baseline gap-0.5 text-xl sm:text-3xl font-black text-white tracking-tight">
                <span>{displayHome}</span>
                <span className="text-pitch-500 text-base sm:text-lg">-</span>
                <span>{displayAway}</span>
              </div>
              <span className="text-[9px] text-pitch-500 uppercase mt-0.5">
                {isKickOff
                  ? "Kick off"
                  : activeMoment!.pointsAdded
                    ? `+${activeMoment!.pointsAdded} pts`
                    : activeMoment!.type === "HALF_TIME"
                      ? "Break"
                      : activeMoment!.type === "FULL_TIME"
                        ? "Final"
                        : "Play"}
              </span>
            </div>

            <div className="col-span-3 flex items-center justify-start gap-2 sm:gap-3 text-left">
              <div
                className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-[10px] sm:text-sm shadow-md border border-white/20 shrink-0"
                style={{
                  backgroundColor: awayClub?.primaryColor || "#D00000",
                  color: awayClub?.textColour || "#FFFFFF",
                }}
              >
                {awayClub?.abbreviation || awayClub?.shortName?.slice(0, 3) || "AWY"}
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

          <div className="mt-3 w-full bg-pitch-950 rounded-full h-1.5 overflow-hidden border border-pitch-800/80">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div
          className={`mt-2.5 min-h-0 flex-1 overflow-hidden rounded-2xl border p-3 sm:p-5 shadow-lg space-y-2 sm:space-y-3 transition-all ${cardStyle}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black border shrink-0 ${badgeInfo.color}`}>
                <span>{badgeInfo.icon}</span>
                <span>{badgeInfo.label}</span>
              </span>
              <span className="text-xs font-mono font-bold text-pitch-400 shrink-0">
                {displayMinute}&apos;
              </span>
            </div>
            {!isKickOff && (
              <span className="text-xs font-bold text-pitch-300 truncate">{activeMoment!.clubName}</span>
            )}
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-black text-white leading-tight">
              {isKickOff
                ? "Kick off"
                : activeMoment!.headline || activeMoment!.title}
            </h3>
          </div>

          <div className="min-h-0 overflow-hidden rounded-xl bg-pitch-950/70 border border-pitch-800/60 p-3 sm:p-3.5">
            <p className="text-xs sm:text-sm text-pitch-200 leading-relaxed italic line-clamp-4 sm:line-clamp-6">
              {isKickOff
                ? `“${homeClub?.name || "Home"} and ${awayClub?.name || "Away"} are underway.”`
                : `“${activeMoment!.description}”`}
            </p>
          </div>

          {!isKickOff && activeMoment!.playerName && (
            <div className="flex items-center justify-between pt-1 border-t border-pitch-800/50 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {activeMoment!.playerPosition && (
                  <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold text-pitch-300 shrink-0">
                    {formatPositionShort(activeMoment!.playerPosition)}
                  </span>
                )}
                <span className="font-bold text-white truncate">{activeMoment!.playerName}</span>
                <span className="text-[11px] text-pitch-400 truncate">({activeMoment!.clubName})</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2.5 flex shrink-0 flex-wrap items-center gap-2 border-t border-pitch-800 pt-2.5">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isFullTime}
            className={`min-h-11 flex-1 rounded-xl px-3.5 py-2 text-xs font-bold transition-all disabled:opacity-40 sm:flex-none ${
              isPlaying
                ? "bg-amber-600 text-white hover:bg-amber-500"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          {!isFullTime && (
            <button
              type="button"
              onClick={handleSkipToFullTime}
              className="min-h-11 flex-1 rounded-xl border border-pitch-700 bg-pitch-900/80 px-3 py-2 text-xs font-semibold text-pitch-300 hover:text-white transition-all sm:flex-none"
            >
              Skip to FT
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenFullReview}
            className="min-h-11 flex-[1.2] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-black text-slate-950 shadow hover:brightness-110 active:scale-95 transition-all sm:flex-none"
          >
            Match report
          </button>
        </div>
      </div>
    </div>
  );
}
