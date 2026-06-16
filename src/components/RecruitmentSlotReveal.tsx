"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import {
  getSlotRevealBio,
  getSlotTeamYearSpinPools,
} from "@/lib/game/slot-team-year-pick";
import { getClubColors } from "@/lib/clubs";
import {
  playSlotLand,
  playSlotSpinStart,
  playSlotSpinTick,
} from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

/** Per-tick delays — fast start, gradual slowdown (~2.1s spin). */
const SPIN_DELAYS_MS = [
  42, 44, 46, 48, 50, 54, 58, 64, 72, 82,
  94, 108, 124, 142, 162, 186, 212, 240,
  272, 308, 348, 392, 440,
] as const;

const BIO_HOLD_MS = 720;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  onComplete: () => void;
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
  const bio = useMemo(
    () => getSlotRevealBio(target.team, target.year),
    [target.team, target.year]
  );

  const [displayTeam, setDisplayTeam] = useState(teams[0] ?? target.team);
  const [displayYear, setDisplayYear] = useState(years[0] ?? target.year);
  const [locked, setLocked] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("Recruitment draw spinning…");

  useEffect(() => {
    let tick = 0;
    let cancelled = false;
    let timeoutId: number | null = null;
    const totalTicks = SPIN_DELAYS_MS.length;

    playSlotSpinStart();

    const runTick = () => {
      if (cancelled) return;

      if (tick < totalTicks) {
        const progress = tick / totalTicks;
        const nearingEnd = tick >= totalTicks - 4;
        if (nearingEnd) {
          setDisplayTeam(target.team);
          setDisplayYear(target.year);
        } else {
          const teamIdx = Math.floor(Math.random() * teams.length);
          const yearIdx = Math.floor(Math.random() * years.length);
          setDisplayTeam(teams[teamIdx] ?? target.team);
          setDisplayYear(years[yearIdx] ?? target.year);
        }

        if (tick % 2 === 0) {
          playSlotSpinTick(progress);
        }

        if (tick > totalTicks * 0.55) {
          setPhaseLabel("Slowing down…");
        } else if (tick > totalTicks * 0.35) {
          setPhaseLabel("Scanning squads…");
        }

        const delay = SPIN_DELAYS_MS[tick] ?? 440;
        tick += 1;
        timeoutId = window.setTimeout(runTick, delay);
        return;
      }

      setDisplayTeam(target.team);
      setDisplayYear(target.year);
      setLocked(true);
      setPhaseLabel("Draw locked");
      playSlotLand();
      timeoutId = window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, BIO_HOLD_MS);
    };

    runTick();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [target, teams, years, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${CARD.panel} card-glass w-full max-w-md overflow-hidden border border-accent-green/25 shadow-[0_0_48px_rgba(34,197,94,0.18)]`}
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
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
            <div
              className={`slot-reveal-reel min-w-0 flex-1 rounded-xl border-2 px-2 py-2.5 transition-all duration-300 sm:px-3 sm:py-3 ${
                locked
                  ? "border-accent-green/55 bg-pitch-950/95 shadow-[inset_0_0_24px_rgba(34,197,94,0.12),0_0_20px_rgba(34,197,94,0.15)]"
                  : "border-pitch-600/70 bg-pitch-950/80 shadow-[inset_0_2px_16px_rgba(0,0,0,0.55)]"
              }`}
              style={{
                borderTopColor: locked ? clubColors.primary : undefined,
              }}
            >
              <p
                className={`slot-reveal-display-text slot-reveal-team-name text-center font-display font-black uppercase text-accent-green ${!locked ? "slot-reveal-blur" : ""}`}
              >
                {displayTeam}
              </p>
            </div>

            <div
              className={`slot-reveal-reel slot-reveal-year-reel shrink-0 rounded-xl border-2 px-2 py-2.5 transition-all duration-300 sm:px-3 sm:py-3 ${
                locked
                  ? "border-accent-green/55 bg-pitch-950/95 shadow-[inset_0_0_24px_rgba(34,197,94,0.12),0_0_20px_rgba(34,197,94,0.15)]"
                  : "border-pitch-600/70 bg-pitch-950/80 shadow-[inset_0_2px_16px_rgba(0,0,0,0.55)]"
              }`}
            >
              <p
                className={`slot-reveal-display-text slot-reveal-year-text text-center font-display font-black tabular-nums text-accent-green ${!locked ? "slot-reveal-blur" : ""}`}
              >
                {displayYear}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {locked && (
              <motion.div
                className="mt-4 rounded-lg border border-accent-green/20 bg-accent-green/5 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <p className={`${TYPO.bodySm} leading-relaxed text-gray-300`}>
                  {bio}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

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
