"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import {
  getAllNormalModeSpinTeams,
  getAllNormalModeSpinYears,
} from "@/lib/game/recruitment-slot-reveal";
import {
  buildSpinReelPlan,
  DEFAULT_SPIN_TICK_COUNT,
} from "@/lib/game/slot-reel";
import { spinTimingMark } from "@/lib/game/spin-timing";
import { getClubColors } from "@/lib/clubs";
import { formatSpinReelTeamName } from "@/lib/clubs/spin-reel-team-name";
import { formatShortYear } from "@/lib/players/prime-year";
import {
  playSlotLand,
  playSlotSpinStart,
  playSlotSpinTick,
} from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { SlotReel, type SlotReelHandle } from "./SlotReel";

const LAND_HOLD_MS = 280;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  onComplete: () => void;
}

export function RecruitmentSlotReveal({
  target,
  onComplete,
}: RecruitmentSlotRevealProps) {
  const teamReelRef = useRef<SlotReelHandle>(null);
  const yearReelRef = useRef<SlotReelHandle>(null);
  const [locked, setLocked] = useState(false);

  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );

  const { teamPlan, yearPlan } = useMemo(() => {
    const t0 = spinTimingMark("reel-plan-start");
    const teams = getAllNormalModeSpinTeams();
    const years = getAllNormalModeSpinYears();
    const teamPlan = buildSpinReelPlan(teams, target.team, DEFAULT_SPIN_TICK_COUNT);
    const yearPlan = buildSpinReelPlan(years, target.year, DEFAULT_SPIN_TICK_COUNT);
    spinTimingMark("reel-plan-ready", t0);
    return { teamPlan, yearPlan };
  }, [target.team, target.year, target.teamYearId]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      teamReelRef.current?.setScrollIndex(teamPlan.finalIndex, false);
      yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, false);
      setLocked(true);
      const timeoutId = window.setTimeout(() => onComplete(), 120);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const delays = teamPlan.delaysMs;
    const totalTicks = delays.length;
    const tAnimStart = spinTimingMark("animation-start");

    teamReelRef.current?.setScrollIndex(
      teamPlan.tickIndices[0] ?? teamPlan.finalIndex,
      false
    );
    yearReelRef.current?.setScrollIndex(
      yearPlan.tickIndices[0] ?? yearPlan.finalIndex,
      false
    );

    let tick = 0;

    const runTick = () => {
      if (cancelled) return;

      if (tick < totalTicks) {
        const delay = delays[tick] ?? 80;
        const progress = tick / totalTicks;

        teamReelRef.current?.setScrollIndex(
          teamPlan.tickIndices[tick] ?? teamPlan.finalIndex,
          false
        );
        yearReelRef.current?.setScrollIndex(
          yearPlan.tickIndices[tick] ?? yearPlan.finalIndex,
          false
        );

        if (tick === 0) playSlotSpinStart();
        playSlotSpinTick(progress, delay);

        tick += 1;
        timeoutId = window.setTimeout(runTick, delay);
        return;
      }

      teamReelRef.current?.setScrollIndex(teamPlan.finalIndex, true);
      yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, true);
      setLocked(true);
      playSlotLand();
      spinTimingMark("animation-end", tAnimStart);

      timeoutId = window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, LAND_HOLD_MS);
    };

    timeoutId = window.setTimeout(runTick, 0);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [teamPlan, yearPlan, onComplete, target.teamYearId]);

  const reelShellClass = (isLocked: boolean) =>
    `slot-reveal-reel min-w-0 flex-1 rounded-xl border-2 px-1 py-0 ${
      isLocked
        ? "slot-reel-lock-flash border-accent-green/55 bg-pitch-950/95"
        : "border-pitch-600/70 bg-pitch-950/80"
    }`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${CARD.panel} w-full max-w-md overflow-hidden border border-accent-green/25`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div
          className="border-b border-pitch-700/50 px-4 py-3 text-center sm:px-6 sm:py-4"
          style={{
            background: `linear-gradient(180deg, ${clubColors.primary}18 0%, transparent 100%)`,
          }}
        >
          <p className={TYPO.sectionLabel}>Recruitment draw</p>
          <p className="mt-1 font-display text-base font-bold text-white sm:text-lg">
            Spin for your signing
          </p>
        </div>

        <div className="px-3 py-4 sm:px-6 sm:py-6">
          <div className="flex max-w-full items-stretch justify-center gap-1.5 sm:gap-2.5">
            <div
              className={reelShellClass(locked)}
              style={{ borderTopColor: locked ? clubColors.primary : undefined }}
            >
              <SlotReel
                ref={teamReelRef}
                strip={teamPlan.strip}
                formatItem={formatSpinReelTeamName}
                textClassName="slot-reveal-team-name"
              />
            </div>
            <div className={`${reelShellClass(locked)} slot-reveal-year-reel shrink-0`}>
              <SlotReel
                ref={yearReelRef}
                strip={yearPlan.strip}
                formatItem={formatShortYear}
                textClassName="slot-reveal-year-text tabular-nums"
              />
            </div>
          </div>

          {locked && (
            <p className="mt-3 text-center font-display text-sm font-bold text-white sm:text-base">
              {target.team}{" "}
              <span className="text-accent-green">
                {formatShortYear(target.year)}
              </span>
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
