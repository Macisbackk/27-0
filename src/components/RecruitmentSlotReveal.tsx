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
  computeSlotReelScrollY,
  DEFAULT_SPIN_DURATION_MS,
} from "@/lib/game/slot-reel";
import { spinTimingMark } from "@/lib/game/spin-timing";
import { getClubColors } from "@/lib/clubs";
import { formatSpinReelTeamName } from "@/lib/clubs/spin-reel-team-name";
import { formatShortYear } from "@/lib/players/prime-year";
import { playSlotLand, playSlotSpinStart, playSlotSpinTick } from "@/lib/sound";
import { SPACING } from "@/lib/ui/design-system";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { uiLayerClass } from "@/lib/ui/layers";
import { useScrollLock } from "@/hooks/useScrollLock";
import { TYPO } from "@/lib/ui/typography";
import { SlotReel, type SlotReelHandle } from "./SlotReel";

const LAND_HOLD_MS = 380;
const TICK_SOUND_EVERY_ITEMS = 3;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  spinVariant?: SpinPoolVariant;
  /** Small status line for an armed pre-game boost (no boost controls). */
  boostStatus?: string | null;
  onComplete: () => void;
}

export function RecruitmentSlotReveal({
  target,
  spinVariant = "current",
  boostStatus = null,
  onComplete,
}: RecruitmentSlotRevealProps) {
  const isEraSpin = spinVariant === "era";
  const teamReelRef = useRef<SlotReelHandle>(null);
  const yearReelRef = useRef<SlotReelHandle>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const clubPrimaryRef = useRef(getClubColors(target.team).primary);
  const [isSpinning, setIsSpinning] = useState(true);
  const [landed, setLanded] = useState(false);

  // Lock while spinning; release once the result has settled.
  useScrollLock(!landed, "quick-mode-spin");

  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );

  onCompleteRef.current = onComplete;
  clubPrimaryRef.current = clubColors.primary;

  const { teamPlan, yearPlan } = useMemo(() => {
    const t0 = spinTimingMark("reel-plan-start");
    const teams = getSpinTeamsForVariant(spinVariant);
    const teamPlan = buildSpinReelPlan(
      teams,
      target.team,
      undefined,
      DEFAULT_SPIN_DURATION_MS
    );
    const yearPlan = isEraSpin
      ? buildSpinReelPlan(
          getSpinYearsForVariant(spinVariant),
          target.year,
          undefined,
          DEFAULT_SPIN_DURATION_MS
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
        shell.classList.add("bg-pitch-950/95");
        (shell as HTMLElement).style.borderColor = clubPrimaryRef.current;
        (shell as HTMLElement).style.borderTopColor = clubPrimaryRef.current;
      }
    };

    const completeAndRelease = () => {
      onCompleteRef.current();
    };

    if (prefersReducedMotion) {
      teamReelRef.current?.setScrollIndex(teamPlan.finalIndex, false);
      if (isEraSpin && yearPlan) {
        yearReelRef.current?.setScrollIndex(yearPlan.finalIndex, false);
      }
      lockReels();
      const timeoutId = window.setTimeout(() => {
        completeAndRelease();
      }, 120);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    let cancelled = false;
    let rafId = 0;
    let holdTimeout: number | null = null;
    const tAnimStart = spinTimingMark("animation-start");

    const teamStartY = computeSlotReelScrollY(teamPlan.startIndex);
    const teamEndY = computeSlotReelScrollY(teamPlan.finalIndex);
    const yearStartY = yearPlan
      ? computeSlotReelScrollY(yearPlan.startIndex)
      : 0;
    const yearEndY = yearPlan ? computeSlotReelScrollY(yearPlan.finalIndex) : 0;

    teamReelRef.current?.setScrollY(teamStartY);
    if (isEraSpin && yearPlan) {
      yearReelRef.current?.setScrollY(yearStartY);
    }

    playSlotSpinStart();

    const duration = teamPlan.durationMs;
    const startTime = performance.now();
    let lastTickItem = teamPlan.startIndex;
    let lastTickSoundAt = startTime;

    const easeOut = (t: number) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - Math.pow(1 - t, 4);
    };

    const finish = () => {
      if (cancelled) return;
      teamReelRef.current?.setScrollY(teamEndY);
      if (isEraSpin && yearPlan) {
        yearReelRef.current?.setScrollY(yearEndY);
      }
      playSlotLand();
      lockReels();
      spinTimingMark("animation-end", tAnimStart);
      holdTimeout = window.setTimeout(() => {
        if (!cancelled) completeAndRelease();
      }, LAND_HOLD_MS);
    };

    const frame = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startTime;
      const linear = Math.min(1, elapsed / duration);
      const eased = easeOut(linear);

      const teamY = teamStartY + (teamEndY - teamStartY) * eased;
      teamReelRef.current?.setScrollY(teamY);
      if (isEraSpin && yearPlan) {
        const yearY = yearStartY + (yearEndY - yearStartY) * eased;
        yearReelRef.current?.setScrollY(yearY);
      }

      const teamItem = Math.round(
        teamPlan.startIndex +
          (teamPlan.finalIndex - teamPlan.startIndex) * eased
      );
      if (
        teamItem !== lastTickItem &&
        teamItem - teamPlan.startIndex > 0 &&
        (teamItem - teamPlan.startIndex) % TICK_SOUND_EVERY_ITEMS === 0 &&
        now - lastTickSoundAt > 40
      ) {
        playSlotSpinTick(linear, 50);
        lastTickSoundAt = now;
      }
      lastTickItem = teamItem;

      if (linear < 1) {
        rafId = window.requestAnimationFrame(frame);
      } else {
        finish();
      }
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (holdTimeout) window.clearTimeout(holdTimeout);
    };
  }, [teamPlan, yearPlan, isEraSpin]);

  return (
    <BodyPortal>
      <div
        className={`recruitment-spin-backdrop fixed inset-0 flex items-center justify-center bg-black/90 ${uiLayerClass("criticalAnimation")} ${SPACING.modalBackdrop}`}
        role="dialog"
        aria-modal="true"
        aria-label="Recruitment spin"
      >
        <div
          className="recruitment-spin-panel w-full max-w-[min(22rem,92vw)] overflow-hidden rounded-[var(--mobile-radius-medium,10px)] border border-white/12 bg-[var(--mobile-surface-secondary,#080c0d)] shadow-[0_14px_34px_rgba(0,0,0,0.4)]"
          style={{
            boxShadow: landed
              ? `0 14px 34px rgba(0,0,0,0.4), inset 3px 0 0 ${clubColors.primary}`
              : "0 14px 34px rgba(0,0,0,0.4), inset 3px 0 0 rgba(100,116,139,0.45)",
            borderColor: landed ? clubColors.primary : undefined,
            transition: landed
              ? "box-shadow 0.35s ease-out, border-color 0.35s ease-out"
              : undefined,
          }}
        >
          <div className="border-b border-white/10 px-4 py-2.5 text-center">
            <p className={`${TYPO.sectionLabel} text-pitch-400`}>
              {isSpinning ? "Spinning…" : "Landed"}
            </p>
            {boostStatus ? (
              <p className={`mt-1 ${TYPO.meta} text-theme-primary/90`}>
                {boostStatus}
              </p>
            ) : null}
          </div>

          <div ref={shellRef} className="px-3 py-4 sm:px-5 sm:py-5">
            <div
              className={`recruitment-spin-reels flex max-w-full items-stretch justify-center ${
                isEraSpin ? "gap-2" : ""
              }`}
            >
              <div
                className={`slot-reveal-reel recruitment-spin-reel min-w-0 overflow-hidden rounded-xl border border-pitch-600/70 bg-pitch-950/80 px-1 ${
                  isEraSpin ? "flex-1" : "w-full"
                } ${landed ? "recruitment-spin-reel--landed" : ""}`}
              >
                <SlotReel
                  ref={teamReelRef}
                  strip={teamPlan.strip}
                  formatItem={formatSpinReelTeamName}
                  textClassName="slot-reveal-team-name"
                  useClubColors
                />
              </div>
              {isEraSpin && yearPlan && (
                <div
                  className={`slot-reveal-reel slot-reveal-year-reel recruitment-spin-reel recruitment-spin-year-reel min-w-0 shrink-0 flex-1 overflow-hidden rounded-xl border border-pitch-600/70 bg-pitch-950/80 px-1 ${
                    landed ? "recruitment-spin-reel--landed" : ""
                  }`}
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
              className={`mt-3 min-h-[2.5rem] text-center transition-opacity duration-300 ${
                landed ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={!landed}
            >
              <p className="truncate px-1 font-display text-lg font-black text-white sm:text-xl">
                {target.team}
                {isEraSpin && (
                  <>
                    {" "}
                    <span className="text-theme-primary">
                      {formatShortYear(target.year)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
