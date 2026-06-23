"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { playSlotLand, playSlotSpinStart, playSlotSpinTick } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { SlotReel, type SlotReelHandle } from "./SlotReel";

const LAND_HOLD_MS = 240;
const TICK_SOUND_INTERVAL = 4;

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
  const shellRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

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

    const lockReels = () => {
      for (const shell of shellRef.current?.querySelectorAll(".slot-reveal-reel") ??
        []) {
        shell.classList.add("slot-reel-lock-flash");
        shell.classList.remove("border-pitch-600/70", "bg-pitch-950/80");
        shell.classList.add("border-accent-green/55", "bg-pitch-950/95");
        (shell as HTMLElement).style.borderTopColor = clubColors.primary;
      }
      if (resultRef.current) {
        resultRef.current.hidden = false;
      }
    };

    if (prefersReducedMotion) {
      teamReelRef.current?.setScrollIndex(teamPlan.finalIndex, false);
      yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, false);
      lockReels();
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
        else if (tick % TICK_SOUND_INTERVAL === 0) {
          playSlotSpinTick(progress, delay);
        }

        tick += 1;
        timeoutId = window.setTimeout(runTick, delay);
        return;
      }

      teamReelRef.current?.setScrollIndex(teamPlan.finalIndex, true);
      yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, true);
      lockReels();
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
  }, [teamPlan, yearPlan, onComplete, clubColors.primary]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4">
      <div
        className={`${CARD.panel} w-full max-w-md overflow-hidden border border-accent-green/25`}
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

        <div ref={shellRef} className="px-3 py-4 sm:px-6 sm:py-6">
          <div className="flex max-w-full items-stretch justify-center gap-1.5 sm:gap-2.5">
            <div className="slot-reveal-reel min-w-0 flex-1 rounded-xl border-2 border-pitch-600/70 bg-pitch-950/80 px-1 py-0">
              <SlotReel
                ref={teamReelRef}
                strip={teamPlan.strip}
                formatItem={formatSpinReelTeamName}
                textClassName="slot-reveal-team-name"
              />
            </div>
            <div className="slot-reveal-reel slot-reveal-year-reel min-w-0 shrink-0 flex-1 rounded-xl border-2 border-pitch-600/70 bg-pitch-950/80 px-1 py-0">
              <SlotReel
                ref={yearReelRef}
                strip={yearPlan.strip}
                formatItem={formatShortYear}
                textClassName="slot-reveal-year-text tabular-nums"
              />
            </div>
          </div>

          <p
            ref={resultRef}
            hidden
            className="mt-3 text-center font-display text-sm font-bold text-white sm:text-base"
          >
            {target.team}{" "}
            <span className="text-accent-green">
              {formatShortYear(target.year)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
