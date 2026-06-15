"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type { Player, SquadSlot } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { getPlacementPenalty } from "@/lib/game/position-placement";
import {
  FORMATION_COORDS,
  FORMATION_SLOT_INDICES,
  FORMATION_SLOT_NUMBER,
  POSITION_DESCRIPTIONS,
  POSITION_TILE_LABEL,
} from "@/lib/positions";
import { PitchSlotCard, PITCH_SLOT_SIZE_CLASS } from "./PitchSlotCard";

interface RugbyPitchProps {
  squad: SquadSlot[];
  totalValue: number;
  filledCount: number;
  totalSlots: number;
  highlightSlot?: number;
  selectedSlot?: number;
  compact?: boolean;
  hardMode?: boolean;
  interactive?: boolean;
  /** Allow clicking filled slots (e.g. Fantasy Mode change player). */
  allowFilledSlotClick?: boolean;
  onSlotClick?: (slotIndex: number) => void;
  /** @deprecated Hover highlight uses CSS only — avoids layout shake. */
  onSlotHover?: (slotIndex: number | null) => void;
  dimmed?: boolean;
  lockedSlots?: number[];
  /** Draft placement — tooltips show penalty without parent hover state. */
  placementPlayer?: Player | null;
  /** Hide squad value in the header (e.g. when budget is shown elsewhere). */
  hideValueSummary?: boolean;
  /** Era mode: use era team club colours on filled slot cards. */
  clubColorOverride?: string;
}

function RugbyPitchInner({
  squad,
  totalValue,
  filledCount,
  totalSlots,
  highlightSlot,
  selectedSlot,
  compact,
  hardMode,
  interactive,
  allowFilledSlotClick,
  onSlotClick,
  dimmed,
  lockedSlots,
  placementPlayer,
  hideValueSummary,
  clubColorOverride,
}: RugbyPitchProps) {
  const lockedSet = useMemo(() => new Set(lockedSlots ?? []), [lockedSlots]);
  const headerTitle = interactive
    ? "Squad Selection — Click to Recruit"
    : compact
      ? "Team Sheet"
      : "Matchday Squad";

  const slotByIndex = useMemo(
    () => new Map(squad.map((s) => [s.slotIndex, s])),
    [squad]
  );

  return (
    <div className="relative w-full overflow-x-hidden">
      {!compact && (
        <div className="matchday-panel mb-3 flex items-center justify-between px-4 py-2">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent-green">
            {headerTitle}
          </h3>
          <div className="text-right">
            {!hideValueSummary && (
              <>
                {!hardMode ? (
                  <p className="font-display text-lg font-bold text-accent-gold">
                    {formatValue(totalValue)}
                  </p>
                ) : (
                  <p className="font-display text-lg font-bold text-gray-600">
                    ???
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-gray-500">
              {filledCount}/{totalSlots} filled
            </p>
          </div>
        </div>
      )}

      <div
        className={`mx-auto w-full ${
          compact ? "max-w-[380px]" : "max-w-[480px] sm:max-w-[580px] md:max-w-[680px]"
        } ${dimmed ? "opacity-60" : ""}`}
      >
        <div
          className={
            compact
              ? ""
              : "max-h-[min(85vh,820px)] overflow-x-hidden overflow-y-auto sm:max-h-none sm:overflow-visible"
          }
        >
          <div
            className={`relative w-full overflow-hidden rounded-2xl border-2 border-accent-green/40 shadow-[0_0_24px_rgba(34,197,94,0.15)] rugby-pitch-pro ${
              compact
                ? "min-h-[540px]"
                : "min-h-[660px] sm:min-h-[620px] md:min-h-[600px] lg:aspect-[5/8] lg:min-h-0"
            }`}
          >
            <PitchMarkings />

            <div className="absolute inset-0 z-10">
              {FORMATION_SLOT_INDICES.map((slotIndex) => {
                const slot = slotByIndex.get(slotIndex);
                const coords = FORMATION_COORDS[slotIndex];
                if (!slot || !coords) return null;

                const isSelected = selectedSlot === slotIndex;
                const isHighlight = highlightSlot === slotIndex;
                const isEmpty = !slot.player;
                const isLocked = lockedSet.has(slotIndex);
                const canClick = !!(
                  interactive &&
                  !isLocked &&
                  onSlotClick &&
                  (isEmpty || allowFilledSlotClick)
                );

                return (
                  <div
                    key={slotIndex}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${coords.left}%`,
                      top: `${coords.top}%`,
                    }}
                  >
                    <SquadMarker
                      slot={slot}
                      highlighted={isHighlight}
                      selected={isSelected}
                      compact={compact}
                      hardMode={hardMode}
                      interactive={canClick}
                      placementPlayer={placementPlayer}
                      clubColorOverride={clubColorOverride}
                      onClick={
                        canClick ? () => onSlotClick!(slotIndex) : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mx-auto mt-2 h-1.5 max-w-[580px] overflow-hidden rounded-full bg-pitch-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-green to-emerald-400"
            initial={false}
            animate={{ width: `${(filledCount / totalSlots) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </div>
  );
}

export const RugbyPitch = memo(RugbyPitchInner);

function PitchMarkings() {
  const touchLeft = "6%";
  const touchRight = "94%";

  return (
    <>
      <div className="pitch-grass-pro absolute inset-0" />
      <div className="pitch-stadium-shadow absolute inset-0" />

      <div className="pitch-in-goal absolute left-[6%] right-[6%] top-0 h-[8%]" />
      <div className="pitch-in-goal absolute bottom-0 left-[6%] right-[6%] h-[8%]" />

      <div
        className="pitch-line-try absolute left-[6%] right-[6%] top-[8%] h-[2px]"
        aria-hidden
      />
      <div
        className="pitch-line-try absolute bottom-[8%] left-[6%] right-[6%] h-[2px]"
        aria-hidden
      />

      <div className="pitch-line-10m absolute left-[6%] right-[6%] top-[16%] h-px" />
      <div className="pitch-line-10m absolute bottom-[16%] left-[6%] right-[6%] h-px" />

      <div className="pitch-line-20m absolute left-[6%] right-[6%] top-[24%] h-px" />
      <div className="pitch-line-20m absolute bottom-[24%] left-[6%] right-[6%] h-px" />

      <div className="pitch-line-40m absolute left-[6%] right-[6%] top-[32%] h-px" />
      <div className="pitch-line-40m absolute bottom-[32%] left-[6%] right-[6%] h-px" />

      <div className="pitch-line-halfway absolute left-[6%] right-[6%] top-1/2 h-[2px] -translate-y-1/2" />

      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[24%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[42%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[60%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[77%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[91%] h-px" />

      <div
        className="pitch-touchline absolute bottom-[8%] top-[8%] w-px"
        style={{ left: touchLeft }}
      />
      <div
        className="pitch-touchline absolute bottom-[8%] top-[8%] w-px"
        style={{ left: touchRight }}
      />

      <GoalPosts end="top" />
      <GoalPosts end="bottom" />
    </>
  );
}

function GoalPosts({ end }: { end: "top" | "bottom" }) {
  if (end === "top") {
    return (
      <div
        className="absolute left-1/2 top-[8%] z-[1] h-0 w-10 -translate-x-1/2 sm:w-12"
        aria-hidden
      >
        <div className="pitch-line-try absolute left-0 right-0 top-0 h-[2px] rounded-full" />
        <div className="pitch-line-try absolute left-0 top-0 h-3 w-[2px] -translate-y-full rounded-full sm:h-3.5" />
        <div className="pitch-line-try absolute right-0 top-0 h-3 w-[2px] -translate-y-full rounded-full sm:h-3.5" />
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-[8%] left-1/2 z-[1] h-0 w-10 -translate-x-1/2 sm:w-12"
      aria-hidden
    >
      <div className="pitch-line-try absolute bottom-0 left-0 right-0 h-[2px] rounded-full" />
      <div className="pitch-line-try absolute bottom-0 left-0 h-3 w-[2px] translate-y-full rounded-full sm:h-3.5" />
      <div className="pitch-line-try absolute bottom-0 right-0 h-3 w-[2px] translate-y-full rounded-full sm:h-3.5" />
    </div>
  );
}

const EMPTY_SLOT_BASE_CLASS = `squad-marker-empty flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1 py-1 box-border ${PITCH_SLOT_SIZE_CLASS}`;

const EMPTY_SLOT_INTERACTIVE_CLASS =
  "cursor-pointer border-accent-green/50 bg-black/60 hover:border-accent-green hover:bg-accent-green/10 hover:shadow-[0_0_12px_rgba(34,197,94,0.35)] focus-visible:border-accent-green focus-visible:bg-accent-green/10 focus-visible:shadow-[0_0_12px_rgba(34,197,94,0.35)]";

const SquadMarker = memo(function SquadMarker({
  slot,
  highlighted,
  selected,
  compact: _compact,
  hardMode,
  interactive,
  placementPlayer,
  clubColorOverride,
  onClick,
}: {
  slot: SquadSlot;
  highlighted?: boolean;
  selected?: boolean;
  compact?: boolean;
  hardMode?: boolean;
  interactive?: boolean;
  placementPlayer?: Player | null;
  clubColorOverride?: string;
  onClick?: () => void;
}) {
  const player = slot.player;
  const description = POSITION_DESCRIPTIONS[slot.position];

  if (!player) {
    const positionLabel = POSITION_TILE_LABEL[slot.position];
    const shirtNumber = FORMATION_SLOT_NUMBER[slot.slotIndex];

    let stateClass =
      "border-dashed border-accent-green/30 bg-black/40 text-white/40";
    if (selected) {
      stateClass =
        "border-accent-gold bg-accent-gold/20 shadow-[0_0_16px_rgba(251,191,36,0.45)]";
    } else if (highlighted) {
      stateClass =
        "border-accent-gold/80 bg-accent-gold/10 shadow-[0_0_10px_rgba(251,191,36,0.3)]";
    } else if (interactive) {
      stateClass = EMPTY_SLOT_INTERACTIVE_CLASS;
    }

    let tooltip = interactive ? `${slot.label}: ${description}` : undefined;
    if (interactive && placementPlayer) {
      const penalty = getPlacementPenalty(
        placementPlayer.position,
        slot.position
      );
      tooltip =
        penalty === 0
          ? `${slot.label} — no penalty`
          : `${slot.label} — -${penalty} OVR`;
    }

    const inner = (
      <>
        {shirtNumber !== undefined && (
          <span
            className={`font-display text-[11px] font-black leading-none sm:text-xs ${
              interactive ? "text-accent-green" : "text-accent-green/50"
            }`}
          >
            {shirtNumber}
          </span>
        )}
        <span
          className={`w-full text-center font-display text-[8px] font-bold uppercase leading-tight tracking-wide sm:text-[9px] ${
            interactive ? "text-white" : "text-white/40"
          }`}
        >
          {positionLabel}
        </span>
        {interactive && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-accent-green sm:text-[10px]">
            +
          </span>
        )}
      </>
    );

    if (interactive && onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={tooltip}
          className={`${EMPTY_SLOT_BASE_CLASS} ${stateClass} outline-none focus-visible:ring-2 focus-visible:ring-accent-green/50`}
        >
          {inner}
        </button>
      );
    }

    return (
      <div className={`${EMPTY_SLOT_BASE_CLASS} ${stateClass}`} title={tooltip}>
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {interactive && onClick ? (
        <button
          type="button"
          onClick={onClick}
          title={`${slot.label}: change or remove player`}
          className={`rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-green/50 ${
            selected
              ? "ring-2 ring-accent-gold shadow-[0_0_16px_rgba(251,191,36,0.45)]"
              : "hover:ring-2 hover:ring-accent-green/40"
          }`}
        >
          <PitchSlotCard slot={slot} hardMode={hardMode} clubColorOverride={clubColorOverride} />
        </button>
      ) : (
        <PitchSlotCard slot={slot} hardMode={hardMode} clubColorOverride={clubColorOverride} />
      )}
    </motion.div>
  );
});
