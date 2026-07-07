"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import {
  getSpinTeamsForVariant,
  getSpinYearsForVariant,
} from "@/lib/game/recruitment-slot-reveal";
import type { SpinPoolVariant } from "@/lib/game/player-pool-eligibility";
import {
  buildSpinReelPlan,
  DEFAULT_SPIN_TICK_COUNT,
} from "@/lib/game/slot-reel";
import { spinTimingMark } from "@/lib/game/spin-timing";
import { getClubColors } from "@/lib/clubs";
import { formatSpinReelTeamName } from "@/lib/clubs/spin-reel-team-name";
import { formatShortYear } from "@/lib/players/prime-year";
import { playSlotLand, playSlotSpinStart, playSlotSpinTick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { SlotReel, type SlotReelHandle } from "./SlotReel";

const LAND_HOLD_MS = 320;
const TICK_SOUND_INTERVAL = 4;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  spinVariant?: SpinPoolVariant;
  onComplete: () => void;
}

export function RecruitmentSlotReveal({
  target,
  spinVariant = "current",
  onComplete,
}: RecruitmentSlotRevealProps) {
  const isEraSpin = spinVariant === "era";
  const teamReelRef = useRef<SlotReelHandle>(null);
  const yearReelRef = useRef<SlotReelHandle>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [isSpinning, setIsSpinning] = useState(true);
  const [landed, setLanded] = useState(false);

  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );

  const { teamPlan, yearPlan } = useMemo(() => {
    const t0 = spinTimingMark("reel-plan-start");
    const teams = getSpinTeamsForVariant(spinVariant);
    const teamPlan = buildSpinReelPlan(teams, target.team, DEFAULT_SPIN_TICK_COUNT);
    const yearPlan = isEraSpin
      ? buildSpinReelPlan(
          getSpinYearsForVariant(spinVariant),
          target.year,
          DEFAULT_SPIN_TICK_COUNT
        )
      : null;
    spinTimingMark("reel-plan-ready", t0);
    return { teamPlan, yearPlan };
  }, [target.team, target.year, target.teamYearId, spinVariant, isEraSpin]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const lockReels = () => {
      setIsSpinning(false);
      setLanded(true);
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
      if (isEraSpin && yearPlan) {
        yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, false);
      }
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
    if (isEraSpin && yearPlan) {
      yearReelRef.current?.setScrollIndex(
        yearPlan.tickIndices[0] ?? yearPlan.finalIndex,
        false
      );
    }

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
        if (isEraSpin && yearPlan) {
          yearReelRef.current?.setScrollIndex(
            yearPlan.tickIndices[tick] ?? yearPlan.finalIndex,
            false
          );
        }

        if (tick === 0) playSlotSpinStart();
        else if (tick % TICK_SOUND_INTERVAL === 0) {
          playSlotSpinTick(progress, delay);
        }

        tick += 1;
        timeoutId = window.setTimeout(runTick, delay);
        return;
      }

      teamReelRef.current?.setScrollIndex(teamPlan.finalIndex, true);
      if (isEraSpin && yearPlan) {
        yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, true);
      }
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
  }, [teamPlan, yearPlan, onComplete, clubColors.primary, isEraSpin]);

  return (
    <div
      className={`recruitment-spin-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/88 ${SPACING.modalBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-label="Recruitment spin"
    >
      <div
        className={`recruitment-spin-panel ${CARD.elevated} w-full max-w-lg overflow-hidden border shadow-[0_0_48px_rgba(34,197,94,0.12)] ${
          landed ? "border-accent-green/30" : "border-pitch-600/50"
        }`}
        style={{
          boxShadow: landed
            ? `0 0 48px rgba(34,197,94,0.12), inset 4px 0 0 ${clubColors.primary}`
            : "0 0 48px rgba(34,197,94,0.12), inset 4px 0 0 rgba(100,116,139,0.45)",
          transition: "box-shadow 0.35s ease-out, border-color 0.35s ease-out",
        }}
      >
        <div
          className="border-b border-pitch-700/50 px-5 py-4 text-center sm:px-8 sm:py-5"
          style={{
            background: landed
              ? `linear-gradient(180deg, ${clubColors.primary}22 0%, transparent 100%)`
              : "linear-gradient(180deg, rgba(51,65,85,0.35) 0%, transparent 100%)",
            transition: "background 0.35s ease-out",
          }}
        >
          <p className={TYPO.sectionLabel}>Recruitment draw</p>
          <p className="mt-1 font-display text-lg font-bold text-white sm:text-xl">
            {isSpinning ? "Spinning…" : "You landed on"}
          </p>
        </div>

        <div ref={shellRef} className="px-4 py-6 sm:px-8 sm:py-8">
          <div
            className={`recruitment-spin-reels flex max-w-full items-stretch justify-center ${
              isEraSpin ? "gap-2 sm:gap-3" : ""
            }`}
          >
            <div
              className={`slot-reveal-reel recruitment-spin-reel min-w-0 rounded-2xl border-2 border-pitch-600/70 bg-pitch-950/80 px-1.5 py-1 ${
                isEraSpin ? "flex-1" : "w-full"
              } ${isSpinning ? "recruitment-spin-reel--active" : ""} ${
                landed ? "recruitment-spin-reel--landed" : ""
              }`}
            >
              <SlotReel
                ref={teamReelRef}
                strip={teamPlan.strip}
                formatItem={(team) =>
                  isEraSpin ? formatSpinReelTeamName(team) : team
                }
                textClassName="slot-reveal-team-name"
              />
            </div>
            {isEraSpin && yearPlan && (
              <div
                className={`slot-reveal-reel slot-reveal-year-reel recruitment-spin-reel recruitment-spin-year-reel min-w-0 shrink-0 flex-1 rounded-2xl border-2 border-pitch-600/70 bg-pitch-950/80 px-1.5 py-1 ${
                  isSpinning ? "recruitment-spin-reel--active" : ""
                } ${landed ? "recruitment-spin-reel--landed" : ""}`}
              >
                <SlotReel
                  ref={yearReelRef}
                  strip={yearPlan.strip}
                  formatItem={formatShortYear}
                  textClassName="slot-reveal-year-text tabular-nums"
                />
              </div>
            )}
          </div>

          <div
            ref={resultRef}
            hidden
            className="mt-5 text-center"
          >
            <p className="font-display text-xl font-black text-white sm:text-2xl">
              {target.team}
              {isEraSpin && (
                <>
                  {" "}
                  <span className="text-accent-green">
                    {formatShortYear(target.year)}
                  </span>
                </>
              )}
            </p>
            <p className={`mt-1.5 ${TYPO.bodySm} text-gray-400`}>
              Choose your signing…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
