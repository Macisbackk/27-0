"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Player } from "@/lib/types";
import {
  getSlotRevealTarget,
  getTeamSpinPool,
  getYearSpinPool,
} from "@/lib/game/recruitment-slot-reveal";
import { playRevealChoices } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const TEAM_TICK_MS = 55;
const TEAM_TICKS = 14;
const YEAR_TICK_MS = 48;
const YEAR_TICKS = 12;
const HOLD_MS = 280;

interface RecruitmentSlotRevealProps {
  players: [Player, Player];
  positionLabel: string;
  onComplete: () => void;
}

export function RecruitmentSlotReveal({
  players,
  positionLabel,
  onComplete,
}: RecruitmentSlotRevealProps) {
  const target = useMemo(() => getSlotRevealTarget(players), [players]);
  const teamPool = useMemo(() => getTeamSpinPool(target.team), [target.team]);
  const yearPool = useMemo(() => getYearSpinPool(target.year), [target.year]);

  const [phase, setPhase] = useState<"team" | "year">("team");
  const [yearLocked, setYearLocked] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const [phaseLabel, setPhaseLabel] = useState("Scanning clubs…");

  useEffect(() => {
    let tick = 0;
    let cancelled = false;

    const teamInterval = window.setInterval(() => {
      if (cancelled) return;
      const idx = tick % teamPool.length;
      setDisplayValue(teamPool[idx] ?? target.team);
      tick += 1;
      if (tick >= TEAM_TICKS) {
        window.clearInterval(teamInterval);
        setDisplayValue(target.team);
        setPhaseLabel("Locking season…");
        window.setTimeout(() => {
          if (cancelled) return;
          setPhase("year");
        }, HOLD_MS);
      }
    }, TEAM_TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(teamInterval);
    };
  }, [teamPool, target.team]);

  useEffect(() => {
    if (phase !== "year") return;

    let tick = 0;
    let cancelled = false;
    let completeTimer: number | null = null;
    setDisplayValue(yearPool[0] ?? target.year);

    const yearInterval = window.setInterval(() => {
      if (cancelled) return;
      const idx = tick % yearPool.length;
      setDisplayValue(yearPool[idx] ?? target.year);
      tick += 1;
      if (tick >= YEAR_TICKS) {
        window.clearInterval(yearInterval);
        setDisplayValue(target.year);
        setYearLocked(true);
        setPhaseLabel("Offers incoming");
        playRevealChoices();
        completeTimer = window.setTimeout(() => {
          if (!cancelled) onComplete();
        }, HOLD_MS);
      }
    }, YEAR_TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(yearInterval);
      if (completeTimer) window.clearTimeout(completeTimer);
    };
  }, [phase, yearPool, target.year, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${CARD.panel} w-full max-w-md border-accent-green/30 px-5 py-6 text-center shadow-[0_0_40px_rgba(34,197,94,0.2)] sm:px-8 sm:py-8`}
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <p className={TYPO.sectionLabel}>{positionLabel}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
          {phaseLabel}
        </p>

        <div
          className="slot-reveal-window mx-auto mt-5 overflow-hidden rounded-xl border border-accent-green/40 bg-pitch-950/90 px-3 py-4 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5),0_0_24px_rgba(34,197,94,0.15)] sm:mt-6 sm:py-5"
          aria-live="polite"
        >
          <p
            className={`font-display font-black uppercase tracking-tight text-accent-green ${
              phase === "year"
                ? "text-4xl sm:text-5xl"
                : "text-lg leading-tight sm:text-xl"
            }`}
          >
            {displayValue}
          </p>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {(["team", "year"] as const).map((step) => (
            <span
              key={step}
              className={`h-1.5 w-8 rounded-full transition ${
                phase === step || (yearLocked && step === "year")
                  ? "bg-accent-green shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  : phase === "year" && step === "team"
                    ? "bg-accent-green/60"
                    : "bg-pitch-700"
              }`}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
