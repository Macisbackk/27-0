"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { getSlotTeamYearSpinPools } from "@/lib/game/slot-team-year-pick";
import { playRevealChoices } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const TOTAL_TICKS = 26;
const FINAL_HOLD_MS = 420;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  positionLabel: string;
  onComplete: () => void;
}

function tickDelayMs(tick: number): number {
  const progress = tick / TOTAL_TICKS;
  return 24 + progress * progress * 200;
}

export function RecruitmentSlotReveal({
  target,
  positionLabel,
  onComplete,
}: RecruitmentSlotRevealProps) {
  const { teams, years } = useMemo(
    () => getSlotTeamYearSpinPools(target),
    [target]
  );

  const [displayTeam, setDisplayTeam] = useState(teams[0] ?? target.team);
  const [displayYear, setDisplayYear] = useState(years[0] ?? target.year);
  const [locked, setLocked] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("Spinning the draw…");

  useEffect(() => {
    let tick = 0;
    let cancelled = false;
    let timeoutId: number | null = null;

    const runTick = () => {
      if (cancelled) return;

      if (tick < TOTAL_TICKS - 1) {
        const teamIdx = Math.floor(Math.random() * teams.length);
        const yearIdx = Math.floor(Math.random() * years.length);
        setDisplayTeam(teams[teamIdx] ?? target.team);
        setDisplayYear(years[yearIdx] ?? target.year);
        if (tick > TOTAL_TICKS * 0.65) {
          setPhaseLabel("Slowing down…");
        }
        tick += 1;
        timeoutId = window.setTimeout(runTick, tickDelayMs(tick));
        return;
      }

      setDisplayTeam(target.team);
      setDisplayYear(target.year);
      setLocked(true);
      setPhaseLabel("Draw locked");
      playRevealChoices();
      timeoutId = window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, FINAL_HOLD_MS);
    };

    runTick();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [target, teams, years, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${CARD.panel} w-full max-w-lg border-accent-green/30 px-5 py-6 text-center shadow-[0_0_40px_rgba(34,197,94,0.2)] sm:px-8 sm:py-8`}
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <p className={TYPO.sectionLabel}>{positionLabel}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
          {phaseLabel}
        </p>

        <div
          className="mx-auto mt-5 flex max-w-md items-stretch justify-center gap-2 sm:mt-6 sm:gap-3"
          aria-live="polite"
        >
          <div
            className={`slot-reveal-window min-w-0 flex-1 overflow-hidden rounded-xl border px-2 py-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] sm:px-3 sm:py-4 ${
              locked
                ? "border-accent-green/50 bg-pitch-950/90 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                : "border-accent-green/30 bg-pitch-950/80"
            }`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Team
            </p>
            <p className="mt-1 font-display text-sm font-black uppercase leading-tight text-accent-green sm:text-base">
              {displayTeam}
            </p>
          </div>
          <div
            className={`slot-reveal-window w-[5.5rem] shrink-0 overflow-hidden rounded-xl border px-2 py-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] sm:w-24 sm:px-3 sm:py-4 ${
              locked
                ? "border-accent-green/50 bg-pitch-950/90 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                : "border-accent-green/30 bg-pitch-950/80"
            }`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Year
            </p>
            <p className="mt-1 font-display text-2xl font-black text-accent-green sm:text-3xl">
              {displayYear}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          <span
            className={`h-1.5 w-10 rounded-full transition ${
              locked
                ? "bg-accent-green shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                : "bg-accent-green/70 animate-pulse"
            }`}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
