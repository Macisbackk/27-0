"use client";

import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import { formatValue } from "@/lib/players";
import {
  FORMATION_ROWS,
  POSITION_DESCRIPTIONS,
  POSITION_SHORT,
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
  onSlotClick?: (slotIndex: number) => void;
  onSlotHover?: (slotIndex: number | null) => void;
  dimmed?: boolean;
  lockedSlots?: number[];
}

export function RugbyPitch({
  squad,
  totalValue,
  filledCount,
  totalSlots,
  highlightSlot,
  selectedSlot,
  compact,
  hardMode,
  interactive,
  onSlotClick,
  onSlotHover,
  dimmed,
  lockedSlots,
}: RugbyPitchProps) {
  const lockedSet = new Set(lockedSlots ?? []);
  const headerTitle = interactive
    ? "Squad Selection — Click to Recruit"
    : compact
      ? "Team Sheet"
      : "Matchday Squad";

  const slotByIndex = new Map(squad.map((s) => [s.slotIndex, s]));

  return (
    <div className="relative w-full overflow-x-hidden">
      {!compact && (
        <div className="matchday-panel mb-3 flex items-center justify-between px-4 py-2">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent-green">
            {headerTitle}
          </h3>
          <div className="text-right">
            {!hardMode ? (
              <>
                <p className="font-display text-lg font-bold text-accent-gold">
                  {formatValue(totalValue)}
                </p>
                <p className="text-xs text-gray-500">
                  {filledCount}/{totalSlots} filled
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-bold text-gray-600">
                  ???
                </p>
                <p className="text-xs text-gray-500">
                  {filledCount}/{totalSlots} filled
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div
        className={`mx-auto w-full transition ${
          compact ? "max-w-[380px]" : "max-w-[480px] sm:max-w-[580px] md:max-w-[680px]"
        } ${dimmed ? "opacity-60" : ""}`}
      >
        <div
          className={`relative w-full overflow-hidden rounded-2xl border-2 border-white/15 shadow-2xl rugby-pitch-pro ${
            compact
              ? "min-h-[480px]"
              : "min-h-[720px] sm:min-h-[660px] md:min-h-[620px] lg:aspect-[5/8] lg:min-h-0"
          }`}
        >
          <PitchMarkings />

          <div className="absolute inset-x-[10%] inset-y-[9%] z-10 flex flex-col justify-between gap-y-0.5 py-1 sm:inset-y-[10%] sm:gap-y-1 md:gap-y-1.5">
            {FORMATION_ROWS.map((row, rowIndex) => (
              <FormationRow
                key={rowIndex}
                slotIndices={row}
                slotByIndex={slotByIndex}
                highlightSlot={highlightSlot}
                selectedSlot={selectedSlot}
                compact={compact}
                hardMode={hardMode}
                interactive={interactive}
                lockedSet={lockedSet}
                onSlotClick={onSlotClick}
                onSlotHover={onSlotHover}
              />
            ))}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mx-auto mt-2 h-1.5 max-w-[580px] overflow-hidden rounded-full bg-pitch-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-green to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${(filledCount / totalSlots) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </div>
  );
}

function FormationRow({
  slotIndices,
  slotByIndex,
  highlightSlot,
  selectedSlot,
  compact,
  hardMode,
  interactive,
  lockedSet,
  onSlotClick,
  onSlotHover,
}: {
  slotIndices: number[];
  slotByIndex: Map<number, SquadSlot>;
  highlightSlot?: number;
  selectedSlot?: number;
  compact?: boolean;
  hardMode?: boolean;
  interactive?: boolean;
  lockedSet: Set<number>;
  onSlotClick?: (slotIndex: number) => void;
  onSlotHover?: (slotIndex: number | null) => void;
}) {
  const count = slotIndices.length;

  return (
    <div
      className={`grid w-full shrink-0 items-center justify-items-center ${
        count === 1
          ? "grid-cols-1"
          : count === 2
            ? "grid-cols-2 gap-x-3 sm:gap-x-4 md:gap-x-5"
            : "grid-cols-3 gap-x-3 sm:gap-x-4 md:gap-x-5"
      }`}
      style={{
        columnGap: "max(12px, 0.75rem)",
      }}
    >
      {slotIndices.map((slotIndex) => {
        const slot = slotByIndex.get(slotIndex);
        if (!slot) return <div key={slotIndex} />;

        const isSelected = selectedSlot === slotIndex;
        const isHighlight = highlightSlot === slotIndex;
        const isEmpty = !slot.player;
        const isLocked = lockedSet.has(slotIndex);
        const canClick = !!(
          interactive &&
          isEmpty &&
          !isLocked &&
          onSlotClick
        );

        return (
          <div
            key={slotIndex}
            className="flex justify-center"
            onMouseEnter={
              canClick && onSlotHover
                ? () => onSlotHover(slotIndex)
                : undefined
            }
            onMouseLeave={
              onSlotHover ? () => onSlotHover(null) : undefined
            }
          >
            <SquadMarker
              slot={slot}
              highlighted={isHighlight}
              selected={isSelected}
              compact={compact}
              hardMode={hardMode}
              interactive={canClick}
              onClick={
                canClick ? () => onSlotClick(slotIndex) : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

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

      <div className="pitch-line-halfway absolute left-[6%] right-[6%] top-1/2 h-[2px] -translate-y-1/2" />

      <div
        className="pitch-touchline absolute bottom-[8%] top-[8%] w-px"
        style={{ left: touchLeft }}
      />
      <div
        className="pitch-touchline absolute bottom-[8%] top-[8%] w-px"
        style={{ left: touchRight }}
      />

      <div className="absolute left-[6%] right-[6%] top-0 h-px bg-white/25" />
      <div className="absolute bottom-0 left-[6%] right-[6%] h-px bg-white/25" />

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
        <div className="absolute left-0 right-0 top-0 h-[2px] rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.35)]" />
        <div className="absolute left-0 top-0 h-3 w-[2px] -translate-y-full rounded-full bg-white/85 sm:h-3.5" />
        <div className="absolute right-0 top-0 h-3 w-[2px] -translate-y-full rounded-full bg-white/85 sm:h-3.5" />
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-[8%] left-1/2 z-[1] h-0 w-10 -translate-x-1/2 sm:w-12"
      aria-hidden
    >
      <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.35)]" />
      <div className="absolute bottom-0 left-0 h-3 w-[2px] translate-y-full rounded-full bg-white/85 sm:h-3.5" />
      <div className="absolute bottom-0 right-0 h-3 w-[2px] translate-y-full rounded-full bg-white/85 sm:h-3.5" />
    </div>
  );
}

function SquadMarker({
  slot,
  highlighted,
  selected,
  compact,
  hardMode,
  interactive,
  onClick,
}: {
  slot: SquadSlot;
  highlighted?: boolean;
  selected?: boolean;
  compact?: boolean;
  hardMode?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const player = slot.player;
  const description = POSITION_DESCRIPTIONS[slot.position];
  const sizeClass = PITCH_SLOT_SIZE_CLASS;

  if (!player) {
    const positionLabel = POSITION_TILE_LABEL[slot.position];
    const content = (
      <motion.div
        className={`squad-marker-empty group flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1 py-1.5 transition ${sizeClass} ${
          selected
            ? "z-20 border-accent-gold bg-accent-gold/20 shadow-[0_0_16px_rgba(251,191,36,0.45)] ring-2 ring-accent-gold"
            : highlighted
              ? "border-accent-gold bg-accent-gold/10 ring-2 ring-accent-gold/50"
              : interactive
                ? "cursor-pointer border-white/30 bg-black/50 hover:border-accent-green hover:bg-accent-green/10 hover:shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                : "border-dashed border-white/20 bg-black/30"
        }`}
        animate={
          selected
            ? { scale: [1.02, 1.04, 1.02] }
            : highlighted
              ? { scale: [1, 1.02, 1] }
              : {}
        }
        transition={{
          duration: selected ? 0.8 : 1,
          repeat: selected || highlighted ? Infinity : 0,
        }}
        title={interactive ? `${slot.label}: ${description}` : undefined}
      >
        <span
          className={`w-full text-center font-display text-[11px] font-black uppercase leading-tight tracking-wide sm:text-xs ${
            interactive ? "text-white" : "text-white/40"
          }`}
        >
          {positionLabel}
        </span>
        <span
          className={`font-display text-[9px] font-bold tracking-wider sm:text-[10px] ${
            interactive ? "text-gray-400" : "text-white/30"
          }`}
        >
          {POSITION_SHORT[slot.position]}
        </span>
        {interactive && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-accent-green sm:text-[10px]">
            +
          </span>
        )}
      </motion.div>
    );

    if (interactive && onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="border-0 bg-transparent p-0 outline-none focus:ring-2 focus:ring-accent-green/50 rounded-lg"
        >
          {content}
        </button>
      );
    }

    return content;
  }

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <PitchSlotCard
        slot={slot}
        hardMode={hardMode}
        className={sizeClass}
      />
    </motion.div>
  );
}
