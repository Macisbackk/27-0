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
  getLandHoldMs,
  getSpinDurationMs,
} from "@/lib/game/slot-reel";
import { spinTimingMark } from "@/lib/game/spin-timing";
import { formatSpinReelTeamName } from "@/lib/clubs/spin-reel-team-name";
import { formatShortYear } from "@/lib/players/prime-year";
import { playSlotLand, playSlotSpinStart, playSlotSpinTick } from "@/lib/sound";
import { triggerHaptic } from "@/lib/haptics";
import { SPACING } from "@/lib/ui/design-system";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { uiLayerClass } from "@/lib/ui/layers";
import { useScrollLock } from "@/hooks/useScrollLock";
import { TYPO } from "@/lib/ui/typography";
import { SlotReel, type SlotReelHandle } from "./SlotReel";

const TICK_SOUND_EVERY_ITEMS = 3;
/** Ignore taps this soon after opening (the tap on the position that started the spin). */
const SKIP_GUARD_MS = 250;

interface RecruitmentSlotRevealProps {
  target: SlotRevealTarget;
  /**
   * Classic (v1.40): the reel spins positions instead of clubs and lands on the one to fill
   * (labels = positions with an empty slot). The three-club offer follows in the picker.
   */
  positionReel?: { labels: string[]; final: string } | null;
  /** Must match GameBoard spinVariant — Era shows team+year reels; Current is team-only. */
  spinVariant: SpinPoolVariant;
  /** Small status line for an armed pre-game boost (no boost controls). */
  boostStatus?: string | null;
  /** Secondary line, e.g. "Random valid position: Full Back". */
  boostDetail?: string | null;
  /** Position being filled, e.g. "Left Centre". */
  slotLabel?: string;
  /** "Quick spins" setting: ~0.9s reel and a shorter hold on the result. */
  quickSpin?: boolean;
  onComplete: () => void;
}

export function RecruitmentSlotReveal({
  target,
  positionReel = null,
  spinVariant,
  boostStatus = null,
  boostDetail = null,
  slotLabel,
  quickSpin = false,
  onComplete,
}: RecruitmentSlotRevealProps) {
  const spinDurationMs = getSpinDurationMs(quickSpin);
  const landHoldMs = getLandHoldMs(quickSpin);
  const isEraSpin = spinVariant !== "current" && !positionReel;
  const positionKey = positionReel ? `${positionReel.labels.join("|")}>${positionReel.final}` : "";
  const teamReelRef = useRef<SlotReelHandle>(null);
  const yearReelRef = useRef<SlotReelHandle>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const [isSpinning, setIsSpinning] = useState(true);
  const [landed, setLanded] = useState(false);
  const skipRef = useRef<(() => void) | null>(null);
  // Focus moves to the spin so keyboard users can skip it: Escape skips, like a tap.
  const spinDialogRef = useModalA11y(true, () => skipRef.current?.(), { lockScroll: false });
  const openedAtRef = useRef(0);

  // Lock while spinning; release once the result has settled.
  useScrollLock(!landed, "quick-mode-spin");

  onCompleteRef.current = onComplete;

  const { teamPlan, yearPlan } = useMemo(() => {
    const t0 = spinTimingMark("reel-plan-start");
    const teamPlan = positionReel
      ? buildSpinReelPlan(positionReel.labels, positionReel.final, undefined, spinDurationMs)
      : buildSpinReelPlan(getSpinTeamsForVariant(spinVariant), target.team, undefined, spinDurationMs);
    const yearPlan = isEraSpin
      ? buildSpinReelPlan(
          getSpinYearsForVariant(spinVariant),
          target.year,
          undefined,
          spinDurationMs
        )
      : null;
    spinTimingMark("reel-plan-ready", t0);
    return { teamPlan, yearPlan };
    // positionKey stands in for positionReel (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.team, target.year, target.teamYearId, spinVariant, isEraSpin, spinDurationMs, positionKey]);

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
        // No club-colour border on the reels once they land (owner, v1.39): it looked awkward.
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
    let finished = false;
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
      if (cancelled || finished) return;
      finished = true;
      skipRef.current = null;
      window.cancelAnimationFrame(rafId);
      teamReelRef.current?.setScrollY(teamEndY);
      if (isEraSpin && yearPlan) {
        yearReelRef.current?.setScrollY(yearEndY);
      }
      playSlotLand();
      triggerHaptic(18);
      lockReels();
      spinTimingMark("animation-end", tAnimStart);
      holdTimeout = window.setTimeout(() => {
        if (!cancelled) completeAndRelease();
      }, landHoldMs);
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
    openedAtRef.current = startTime;
    // Tap to skip straight to the result.
    skipRef.current = finish;

    return () => {
      cancelled = true;
      skipRef.current = null;
      window.cancelAnimationFrame(rafId);
      if (holdTimeout) window.clearTimeout(holdTimeout);
    };
  }, [teamPlan, yearPlan, isEraSpin, landHoldMs]);

  return (
    <BodyPortal>
      <div
        ref={spinDialogRef}
        tabIndex={-1}
        className={`recruitment-spin-backdrop outline-none fixed inset-0 flex items-center justify-center bg-black/90 ${uiLayerClass("criticalAnimation")} ${SPACING.modalBackdrop}`}
        role="dialog"
        aria-modal="true"
        aria-label="Recruitment spin"
        onPointerUp={() => {
          if (!skipRef.current) return;
          if (performance.now() - openedAtRef.current < SKIP_GUARD_MS) return;
          skipRef.current();
        }}
      >
        <div
          className="recruitment-spin-panel w-full max-w-[min(22rem,92vw)] overflow-hidden rounded-[var(--mobile-radius-medium,10px)] border border-white/12 bg-[var(--mobile-surface-secondary,#080c0d)] shadow-[0_14px_34px_rgba(0,0,0,0.4)]"
          style={{
            boxShadow: "0 14px 34px rgba(0,0,0,0.4)",
            transition: landed ? "border-color 0.35s ease-out" : undefined,
          }}
        >
          {/* No club-colour bar here (owner, v1.39): a neutral top edge before and after the spin. */}
          <div aria-hidden className="h-0.5 w-full bg-white/10" />
          <div className="border-b border-white/10 px-4 py-2.5 text-center">
            <p className={`${TYPO.sectionLabel} text-pitch-400`}>
              {positionReel
                ? isSpinning
                  ? "Spinning for a position…"
                  : "Your next signing is a…"
                : isSpinning
                  ? slotLabel
                    ? `Spinning for your ${slotLabel}…`
                    : "Spinning…"
                  : slotLabel
                    ? `Your ${slotLabel} comes from…`
                    : "Landed"}
            </p>
            {boostStatus ? (
              <p className={`mt-1 ${TYPO.meta} text-theme-primary/90`}>
                {boostStatus}
              </p>
            ) : null}
            {boostDetail ? (
              <p className={`mt-0.5 ${TYPO.meta} text-pitch-400`}>
                {boostDetail}
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
                  formatItem={positionReel ? (item) => item : formatSpinReelTeamName}
                  textClassName="slot-reveal-team-name"
                  useClubColors={!positionReel}
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

            {isSpinning ? (
              <p className={`mt-3 flex min-h-[2.5rem] items-center justify-center ${TYPO.meta} text-pitch-400`} aria-hidden>
                Tap to skip
              </p>
            ) : null}
            <div
              className={`${isSpinning ? "hidden" : "mt-3"} min-h-[2.5rem] text-center transition-opacity duration-300 ${
                landed ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={!landed}
            >
              <p className="truncate px-1 font-display text-lg font-black text-white sm:text-xl">
                {positionReel ? positionReel.final : target.team}
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
