"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { getSlotTeamYearSpinPools } from "@/lib/game/slot-team-year-pick";
import { getClubColors } from "@/lib/clubs";
import { formatShortYear } from "@/lib/players/prime-year";
import {
  playSlotLand,
  playSlotSpinStart,
  playSlotSpinTick,
} from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

/** Per-tick delays — fast start, smooth deceleration (~1.55s spin). */
const SPIN_DELAYS_MS = [
  24, 26, 28, 30, 32, 34, 38, 42, 48, 54,
  62, 72, 84, 98, 114, 132, 152, 174, 198,
] as const;

const LAND_HOLD_MS = 280;
const REEL_ITEM_H = 48;
const STRIP_COPIES = 6;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  onComplete: () => void;
}

function buildReelStrip(items: string[]): string[] {
  if (items.length === 0) return ["—"];
  return Array.from({ length: STRIP_COPIES }, () => items).flat();
}

function computeFinalStripIndex(
  items: string[],
  value: string
): number {
  const itemIdx = items.indexOf(value);
  const safeIdx = itemIdx >= 0 ? itemIdx : 0;
  const copyStart = items.length * (STRIP_COPIES - 1);
  return copyStart + safeIdx;
}

function computeScrollIndexForTick(
  tick: number,
  totalTicks: number,
  startIndex: number,
  finalIndex: number,
  prevIndex: number
): number {
  if (tick >= totalTicks) return finalIndex;
  const progress = (tick + 1) / totalTicks;
  const eased = 1 - Math.pow(1 - progress, 2.35);
  const raw = startIndex + Math.floor(eased * (finalIndex - startIndex));
  return Math.min(finalIndex, Math.max(prevIndex + 1, raw));
}

function SlotReel({
  items,
  scrollIndex,
  locked,
  stepMs,
  formatItem,
  className,
  textClassName,
}: {
  items: string[];
  scrollIndex: number;
  locked: boolean;
  stepMs: number;
  formatItem: (item: string) => string;
  className?: string;
  textClassName?: string;
}) {
  const strip = useMemo(() => buildReelStrip(items), [items]);
  const y = -scrollIndex * REEL_ITEM_H;

  return (
    <div className={`slot-reel-window ${className ?? ""}`}>
      <div
        className="slot-reel-strip"
        style={{
          transform: `translate3d(0, ${y}px, 0)`,
          transition: locked
            ? "transform 280ms cubic-bezier(0.34, 1.45, 0.64, 1)"
            : `transform ${stepMs}ms linear`,
        }}
      >
        {strip.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className={`slot-reel-item slot-reveal-display-text text-center font-display font-black uppercase text-accent-green ${textClassName ?? ""}`}
          >
            {item === "—" ? "—" : formatItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
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

  const teamStartIndex = teams.length > 0 ? teams.length : 0;
  const yearStartIndex = years.length > 0 ? years.length : 0;
  const teamFinalIndex = useMemo(
    () => computeFinalStripIndex(teams, target.team),
    [teams, target.team]
  );
  const yearFinalIndex = useMemo(
    () => computeFinalStripIndex(years, target.year),
    [years, target.year]
  );

  const [teamIndex, setTeamIndex] = useState(teamStartIndex);
  const [yearIndex, setYearIndex] = useState(yearStartIndex);
  const [stepMs, setStepMs] = useState<number>(SPIN_DELAYS_MS[0]);
  const [locked, setLocked] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("Recruitment draw spinning…");
  const teamPrevRef = useRef(teamStartIndex);
  const yearPrevRef = useRef(yearStartIndex);

  useEffect(() => {
    let tick = 0;
    let cancelled = false;
    let timeoutId: number | null = null;
    const totalTicks = SPIN_DELAYS_MS.length;

    teamPrevRef.current = teamStartIndex;
    yearPrevRef.current = yearStartIndex;
    setTeamIndex(teamStartIndex);
    setYearIndex(yearStartIndex);
    setStepMs(SPIN_DELAYS_MS[0]);
    setLocked(false);
    setPhaseLabel("Recruitment draw spinning…");

    const runTick = () => {
      if (cancelled) return;

      if (tick < totalTicks) {
        const delay = SPIN_DELAYS_MS[tick] ?? 198;
        setStepMs(delay);

        const nextTeam = computeScrollIndexForTick(
          tick,
          totalTicks,
          teamStartIndex,
          teamFinalIndex,
          teamPrevRef.current
        );
        const nextYear = computeScrollIndexForTick(
          tick,
          totalTicks,
          yearStartIndex,
          yearFinalIndex,
          yearPrevRef.current
        );
        teamPrevRef.current = nextTeam;
        yearPrevRef.current = nextYear;
        setTeamIndex(nextTeam);
        setYearIndex(nextYear);

        if (tick === 0) {
          playSlotSpinStart();
        }
        if (tick % 2 === 0) {
          playSlotSpinTick(tick / totalTicks);
        }

        if (tick > totalTicks * 0.55) {
          setPhaseLabel("Slowing down…");
        } else if (tick > totalTicks * 0.3) {
          setPhaseLabel("Scanning squads…");
        }

        tick += 1;
        timeoutId = window.setTimeout(runTick, delay);
        return;
      }

      setTeamIndex(teamFinalIndex);
      setYearIndex(yearFinalIndex);
      setLocked(true);
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
    onComplete,
  ]);

  const reelShellClass = (isLocked: boolean) =>
    `slot-reveal-reel min-w-0 flex-1 rounded-xl border-2 px-2 py-1 transition-colors duration-300 sm:px-3 sm:py-1.5 ${
      isLocked
        ? "slot-reel-lock-flash border-accent-green/55 bg-pitch-950/95 shadow-[inset_0_0_24px_rgba(34,197,94,0.12),0_0_20px_rgba(34,197,94,0.15)]"
        : "border-pitch-600/70 bg-pitch-950/80 shadow-[inset_0_2px_16px_rgba(0,0,0,0.55)]"
    }`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 max-sm:backdrop-blur-none sm:backdrop-blur-md"
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

        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div
            className="flex items-stretch justify-center gap-2 sm:gap-2.5"
            aria-live="polite"
          >
            <motion.div
              className={reelShellClass(locked)}
              style={{
                borderTopColor: locked ? clubColors.primary : undefined,
              }}
              animate={
                locked ? { scale: [1, 1.025, 0.995, 1] } : { scale: 1 }
              }
              transition={
                locked
                  ? { duration: 0.32, times: [0, 0.35, 0.65, 1], ease: "easeOut" }
                  : { duration: 0.15 }
              }
            >
              <SlotReel
                items={teams}
                scrollIndex={teamIndex}
                locked={locked}
                stepMs={stepMs}
                formatItem={(team) => team}
                textClassName="slot-reveal-team-name"
              />
            </motion.div>

            <motion.div
              className={`${reelShellClass(locked)} slot-reveal-year-reel shrink-0`}
              animate={
                locked ? { scale: [1, 1.025, 0.995, 1] } : { scale: 1 }
              }
              transition={
                locked
                  ? {
                      duration: 0.32,
                      times: [0, 0.35, 0.65, 1],
                      ease: "easeOut",
                      delay: 0.04,
                    }
                  : { duration: 0.15 }
              }
            >
              <SlotReel
                items={years}
                scrollIndex={yearIndex}
                locked={locked}
                stepMs={stepMs}
                formatItem={formatShortYear}
                textClassName="slot-reveal-year-text tabular-nums"
              />
            </motion.div>
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
