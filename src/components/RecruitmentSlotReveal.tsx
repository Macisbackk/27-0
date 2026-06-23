"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { getSlotTeamYearSpinPools } from "@/lib/game/slot-team-year-pick";
import {
  computeSlotReelFinalIndex,
  buildSlotReelPool,
  buildSpinReelTickIndices,
  buildSpinReelDelaysMs,
  DEFAULT_SPIN_TICK_COUNT,
} from "@/lib/game/slot-reel";
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
import { SlotReel, useSlotReelStrip } from "./SlotReel";

const SPIN_DELAYS_MS = buildSpinReelDelaysMs(DEFAULT_SPIN_TICK_COUNT);
const LAND_HOLD_MS = 320;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  onComplete: () => void;
}

function computeScrollIndexForTick(
  tick: number,
  tickIndices: number[]
): number {
  return tickIndices[Math.min(tick, tickIndices.length - 1)] ?? 0;
}

export function RecruitmentSlotReveal({
  target,
  onComplete,
}: RecruitmentSlotRevealProps) {
  const { teams, years } = useMemo(
    () => getSlotTeamYearSpinPools(target),
    [target]
  );
  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );

  const teamPool = useMemo(
    () => buildSlotReelPool(teams, target.team),
    [teams, target.team]
  );
  const yearPool = useMemo(
    () => buildSlotReelPool(years, target.year),
    [years, target.year]
  );

  const teamStrip = useSlotReelStrip(teamPool);
  const yearStrip = useSlotReelStrip(yearPool);

  const teamStartIndex = teamPool.length * 2;
  const yearStartIndex = yearPool.length * 2;
  const teamFinalIndex = useMemo(
    () => computeSlotReelFinalIndex(teamPool, target.team),
    [teamPool, target.team]
  );
  const yearFinalIndex = useMemo(
    () => computeSlotReelFinalIndex(yearPool, target.year),
    [yearPool, target.year]
  );

  const teamTickIndices = useMemo(
    () =>
      buildSpinReelTickIndices(
        teamPool,
        target.team,
        DEFAULT_SPIN_TICK_COUNT
      ),
    [teamPool, target.team]
  );
  const yearTickIndices = useMemo(
    () =>
      buildSpinReelTickIndices(
        yearPool,
        target.year,
        DEFAULT_SPIN_TICK_COUNT
      ),
    [yearPool, target.year]
  );

  const [teamIndex, setTeamIndex] = useState(teamStartIndex);
  const [yearIndex, setYearIndex] = useState(yearStartIndex);
  const [stepMs, setStepMs] = useState<number>(SPIN_DELAYS_MS[0] ?? 18);
  const [locked, setLocked] = useState(false);
  const [spinning, setSpinning] = useState(true);
  const [phaseLabel, setPhaseLabel] = useState("Recruitment draw spinning…");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if (!teamPool.includes(target.team)) {
        console.warn("Spin reel missing final team", {
          targetTeam: target.team,
          teamPool,
        });
      }
      if (!yearPool.includes(target.year)) {
        console.warn("Spin reel missing final year", {
          targetYear: target.year,
          yearPool,
        });
      }
    }
  }, [teamPool, yearPool, target.team, target.year]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setTeamIndex(teamFinalIndex);
      setYearIndex(yearFinalIndex);
      setLocked(true);
      setSpinning(false);
      setPhaseLabel("Draw locked");
      const timeoutId = window.setTimeout(() => onComplete(), 120);
      return () => window.clearTimeout(timeoutId);
    }

    let tick = 0;
    let cancelled = false;
    let timeoutId: number | null = null;
    const totalTicks = SPIN_DELAYS_MS.length;

    setTeamIndex(teamStartIndex);
    setYearIndex(yearStartIndex);
    setStepMs(SPIN_DELAYS_MS[0] ?? 18);
    setLocked(false);
    setSpinning(true);
    setPhaseLabel("Recruitment draw spinning…");

    const runTick = () => {
      if (cancelled) return;

      if (tick < totalTicks) {
        const delay = SPIN_DELAYS_MS[tick] ?? 180;
        const progress = tick / totalTicks;
        setStepMs(delay);

        setTeamIndex(computeScrollIndexForTick(tick, teamTickIndices));
        setYearIndex(computeScrollIndexForTick(tick, yearTickIndices));

        if (tick === 0) {
          playSlotSpinStart();
        }
        playSlotSpinTick(progress, delay);

        if (tick > totalTicks * 0.62) {
          setPhaseLabel("Slowing down…");
        } else if (tick > totalTicks * 0.28) {
          setPhaseLabel("Scanning squads…");
        }

        tick += 1;
        timeoutId = window.setTimeout(runTick, delay);
        return;
      }

      setTeamIndex(teamFinalIndex);
      setYearIndex(yearFinalIndex);
      setLocked(true);
      setSpinning(false);
      setPhaseLabel("Draw locked");
      playSlotLand();
      timeoutId = window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, LAND_HOLD_MS);
    };

    const startFrame = window.requestAnimationFrame(() => {
      if (!cancelled) runTick();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(startFrame);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    target.teamYearId,
    teamStartIndex,
    yearStartIndex,
    teamFinalIndex,
    yearFinalIndex,
    teamTickIndices,
    yearTickIndices,
    onComplete,
  ]);

  const reelShellClass = (isLocked: boolean) =>
    `slot-reveal-reel min-w-0 flex-1 rounded-xl border-2 px-1 py-0 transition-colors duration-300 sm:px-2 ${
      isLocked
        ? "slot-reel-lock-flash border-accent-green/55 bg-pitch-950/95 shadow-[inset_0_0_24px_rgba(34,197,94,0.12),0_0_20px_rgba(34,197,94,0.15)]"
        : "border-pitch-600/70 bg-pitch-950/80 shadow-[inset_0_2px_16px_rgba(0,0,0,0.55)]"
    }`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 max-sm:backdrop-blur-none sm:p-4 sm:backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${CARD.panel} card-glass w-full max-w-md overflow-hidden border border-accent-green/25 shadow-[0_0_48px_rgba(34,197,94,0.18)]`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
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
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-gray-500">
            {phaseLabel}
          </p>
        </div>

        <div className="px-3 py-4 sm:px-6 sm:py-6">
          <div
            className="flex max-w-full items-stretch justify-center gap-1.5 sm:gap-2.5"
            aria-live="polite"
          >
            <div
              className={reelShellClass(locked)}
              style={{
                borderTopColor: locked ? clubColors.primary : undefined,
              }}
            >
              <SlotReel
                strip={teamStrip}
                scrollIndex={teamIndex}
                locked={locked}
                stepMs={stepMs}
                spinning={spinning}
                formatItem={formatSpinReelTeamName}
                textClassName="slot-reveal-team-name"
              />
            </div>

            <div
              className={`${reelShellClass(locked)} slot-reveal-year-reel shrink-0`}
            >
              <SlotReel
                strip={yearStrip}
                scrollIndex={yearIndex}
                locked={locked}
                stepMs={stepMs}
                spinning={spinning}
                formatItem={formatShortYear}
                textClassName="slot-reveal-year-text tabular-nums"
              />
            </div>
          </div>

          {locked && (
            <motion.p
              className="mt-3 text-center font-display text-sm font-bold text-white sm:text-base"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.25 }}
            >
              {target.team}{" "}
              <span className="text-accent-green">
                {formatShortYear(target.year)}
              </span>
            </motion.p>
          )}

          <div className="mt-4 flex justify-center">
            <span
              className={`h-1 rounded-full transition-all duration-500 ${
                locked
                  ? "w-16 bg-accent-green shadow-[0_0_10px_rgba(34,197,94,0.55)]"
                  : "w-10 animate-pulse bg-accent-green/60"
              }`}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
