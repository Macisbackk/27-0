"use client";

import { memo, useMemo, type MouseEvent } from "react";
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
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { TYPO } from "@/lib/ui/typography";
import { ClubShirt } from "./ClubShirt";
import { useCosmetics } from "@/lib/storage/cosmetics-store";
import { PITCH_STYLES, kitFromDesign, pitchStyleForItem } from "@/lib/cosmetics";
import type { ClubKit } from "@/lib/club-kits";
import { PitchSlotCard, pitchSlotLabel, PITCH_SLOT_COMPACT_CLASS, PITCH_SLOT_REVIEW_CLASS, PITCH_SLOT_SIZE_CLASS } from "./PitchSlotCard";

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
  /** Desktop double-click on a filled slot (e.g. manager player options). */
  onFilledSlotDoubleClick?: (slotIndex: number) => void;
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
  /** Read-only compact formation for Player Representation. */
  formationOnly?: boolean;
  /** Manager squad editor — highlight slots for swap / assign. */
  slotAccent?: Partial<Record<number, "source" | "target">>;
  /**
   * When false, filled slots skip Framer entrance fades.
   * Manager team sheets must stay stable across career re-renders.
   */
  animateSlotEntrance?: boolean;
}

/** Shared layout + typography for recruitment, review, and manager team sheets. */
export const TEAM_SHEET_RUGBY_PITCH_PROPS = {
  formationOnly: true,
  compact: true,
  hideValueSummary: true,
  animateSlotEntrance: false,
} as const satisfies Pick<
  RugbyPitchProps,
  "formationOnly" | "compact" | "hideValueSummary" | "animateSlotEntrance"
>;

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
  onFilledSlotDoubleClick,
  dimmed,
  lockedSlots,
  placementPlayer,
  hideValueSummary,
  clubColorOverride,
  formationOnly = false,
  slotAccent,
  animateSlotEntrance = true,
}: RugbyPitchProps) {
  const lockedSet = useMemo(() => new Set(lockedSlots ?? []), [lockedSlots]);
  // Store cosmetics: your own kit on every shirt, and the pitch style you've equipped.
  const cosmetics = useCosmetics();
  const kitOverride = useMemo<ClubKit | null>(
    () => (cosmetics.kit.enabled ? kitFromDesign(cosmetics.kit) : null),
    [cosmetics.kit]
  );
  const pitchStyle = pitchStyleForItem(cosmetics.equipped.pitch);
  const headerTitle = formationOnly
    ? "Team Sheet"
    : interactive
      ? "Tap a position to sign"
      : compact
        ? "Team Sheet"
        : "Matchday Squad";

  const slotSizeClass = formationOnly
    ? PITCH_SLOT_REVIEW_CLASS
    : compact
      ? PITCH_SLOT_COMPACT_CLASS
      : PITCH_SLOT_SIZE_CLASS;

  const slotByIndex = useMemo(
    () => new Map(squad.map((s) => [s.slotIndex, s])),
    [squad]
  );

  return (
    <div className="relative w-full overflow-x-hidden">
      {!compact && !formationOnly && (
        <ScoreboardPanel className="mb-3 flex items-center justify-between px-4 py-2">
          <h3 className={TYPO.sectionTitle}>
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
        </ScoreboardPanel>
      )}

      <div
        className={`mx-auto w-full ${
          formationOnly
            ? "max-w-[min(100%,400px)]"
            : compact
              ? "max-w-[380px]"
              : "max-w-[min(100%,400px)] sm:max-w-[540px] md:max-w-[640px]"
        } ${dimmed ? "opacity-60" : ""}`}
      >
        <div
          className={
            compact || formationOnly
              ? ""
              : "overflow-x-hidden sm:overflow-visible"
          }
        >
          <div
            className={`rugby-pitch relative w-full overflow-hidden ${
              formationOnly
                ? "team-sheet-pitch aspect-[5/7.2] min-h-[400px] max-h-[min(520px,calc(100dvh-330px))] rounded-card"
                : "rugby-pitch-pro rounded-control border border-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            } ${
              formationOnly
                ? ""
                : compact
                  ? "min-h-[360px] sm:min-h-[540px]"
                  : "min-h-[400px] sm:min-h-[580px] md:min-h-[580px] lg:aspect-[5/8] lg:min-h-0"
            }`}
          >
            {formationOnly ? <TeamSheetMarkings style={pitchStyle} /> : <PitchMarkings />}

            <div className="absolute inset-0 z-10">
              {FORMATION_SLOT_INDICES.map((slotIndex) => {
                const slot = slotByIndex.get(slotIndex);
                const baseCoords = FORMATION_COORDS[slotIndex];
                if (!slot || !baseCoords) return null;
                const coords = formationOnly ? teamSheetCoords(baseCoords) : baseCoords;

                const isSelected = selectedSlot === slotIndex;
                const isHighlight = highlightSlot === slotIndex;
                const accent = slotAccent?.[slotIndex];
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
                      accent={accent}
                      compact={compact || formationOnly}
                      fullPlayerNames={formationOnly}
                      hardMode={hardMode}
                      interactive={canClick}
                      placementPlayer={placementPlayer}
                      clubColorOverride={clubColorOverride}
                      slotSizeClass={slotSizeClass}
                      animateEntrance={animateSlotEntrance}
                      kitOverride={kitOverride}
                      onClick={
                        canClick ? () => onSlotClick!(slotIndex) : undefined
                      }
                      onDoubleClick={
                        canClick && slot.player && onFilledSlotDoubleClick
                          ? (e) => {
                              e.preventDefault();
                              onFilledSlotDoubleClick(slotIndex);
                            }
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!compact && !formationOnly && (
        <div className="mx-auto mt-2 h-1.5 max-w-[640px] overflow-hidden rounded-full bg-pitch-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-tertiary"
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

/** Team sheet rows spread over the whole pitch so shirts and name tags have room. */
const TEAM_SHEET_TOP: Record<number, number> = { 8: 10, 24: 29, 40: 48, 58: 67, 76: 87 };
const TEAM_SHEET_LEFT: Record<number, number> = { 14: 13, 34: 37.5, 66: 62.5, 86: 87 };
function teamSheetCoords(coords: { left: number; top: number }) {
  return {
    left: TEAM_SHEET_LEFT[coords.left] ?? coords.left,
    top: TEAM_SHEET_TOP[coords.top] ?? coords.top,
  };
}

/** Quiet pitch for the team sheet: mown bands, try lines and halfway only (style from the Store). */
function TeamSheetMarkings({ style = "classic" }: { style?: keyof typeof PITCH_STYLES }) {
  const look = PITCH_STYLES[style] ?? PITCH_STYLES.classic;
  return (
    <>
      <div className="absolute inset-0" style={{ background: look.background }} />
      <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2" style={{ background: look.line }} aria-hidden />
      <div className="absolute left-0 right-0 top-[3%] h-px opacity-60" style={{ background: look.line }} aria-hidden />
      <div className="absolute bottom-[3%] left-0 right-0 h-px opacity-60" style={{ background: look.line }} aria-hidden />
    </>
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

      <div className="pitch-line-40m absolute left-[6%] right-[6%] top-[32%] h-px" />
      <div className="pitch-line-40m absolute bottom-[32%] left-[6%] right-[6%] h-px" />

      <div className="pitch-line-halfway absolute left-[6%] right-[6%] top-1/2 h-[2px] -translate-y-1/2" />

      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[22%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[40%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[58%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[76%] h-px" />
      <div className="pitch-guide-dashed absolute left-[6%] right-[6%] top-[92%] h-px" />

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

const EMPTY_SLOT_BASE_CLASS =
  "squad-marker-empty flex shrink-0 flex-col items-center justify-center gap-0 rounded-lg border px-0.5 py-0.5 box-border";

const EMPTY_SLOT_INTERACTIVE_CLASS =
  "cursor-pointer border-pitch-500/55 bg-pitch-950/70 hover:border-theme-primary/55 hover:bg-theme-primary/10 focus-visible:border-theme-primary focus-visible:bg-theme-primary/10";

const SquadMarker = memo(function SquadMarker({
  slot,
  highlighted,
  selected,
  accent,
  compact: _compact,
  fullPlayerNames = false,
  hardMode,
  interactive,
  placementPlayer,
  clubColorOverride,
  slotSizeClass = PITCH_SLOT_SIZE_CLASS,
  animateEntrance = true,
  kitOverride = null,
  onClick,
  onDoubleClick,
}: {
  slot: SquadSlot;
  highlighted?: boolean;
  selected?: boolean;
  accent?: "source" | "target";
  compact?: boolean;
  fullPlayerNames?: boolean;
  hardMode?: boolean;
  interactive?: boolean;
  placementPlayer?: Player | null;
  clubColorOverride?: string;
  slotSizeClass?: string;
  animateEntrance?: boolean;
  kitOverride?: ClubKit | null;
  onClick?: () => void;
  onDoubleClick?: (e: MouseEvent) => void;
}) {
  const player = slot.player;
  const description = POSITION_DESCRIPTIONS[slot.position];

  if (!player) {
    const positionLabel =
      _compact || fullPlayerNames
        ? pitchSlotLabel(slot.label)
        : POSITION_TILE_LABEL[slot.position];
    const shirtNumber = FORMATION_SLOT_NUMBER[slot.slotIndex];

    let stateClass =
      "border-dashed border-white/15 bg-pitch-950/55 text-white/40";
    if (accent === "source") {
      stateClass =
        "border-theme-primary/60 bg-theme-primary/12";
    } else if (accent === "target") {
      stateClass =
        "border-accent-gold/55 bg-accent-gold/10 ring-1 ring-accent-gold/40 animate-pulse motion-reduce:animate-none";
    } else if (selected) {
      stateClass =
        "border-accent-gold/55 bg-accent-gold/15 ring-1 ring-accent-gold/35";
    } else if (highlighted) {
      stateClass =
        "border-accent-gold/45 bg-accent-gold/10";
    } else if (interactive) {
      stateClass = EMPTY_SLOT_INTERACTIVE_CLASS;
    }

    let tooltip = interactive ? `${slot.label}: ${description}` : undefined;
    if (interactive && placementPlayer) {
      const penalty = getPlacementPenalty(
        placementPlayer.position,
        slot.position,
        placementPlayer
      );
      if (penalty > 0) {
        tooltip = `${slot.label} — out of position`;
      }
    }

    if (fullPlayerNames) {
      // Team sheet: a dashed shirt outline with the position on a tag underneath.
      const ring =
        accent === "source"
          ? "ring-2 ring-theme-primary/70"
          : accent === "target" || selected || highlighted
            ? "ring-2 ring-accent-gold/60"
            : "";
      const shirt = (
        <>
          <span className={`rounded-xl ${ring} ${interactive ? "text-theme-primary" : "text-white/40"}`}>
            <ClubShirt kit={null} label="+" size={46} />
          </span>
          <span
            className={`mt-0.5 max-w-full whitespace-nowrap rounded-md bg-pitch-950/80 px-1 py-[3px] font-semibold leading-none ${
              positionLabel.length > 11 ? "text-[9px]" : "text-[10px]"
            } ${interactive ? "text-white/85" : "text-white/45"}`}
          >
            {positionLabel.replace("Loose Forward", "Loose Fwd")}
          </span>
        </>
      );
      return interactive && onClick ? (
        <button
          type="button"
          onClick={onClick}
          title={tooltip}
          aria-label={`${slot.label}: empty — tap to spin`}
          className="btn-press flex w-[76px] flex-col items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50"
        >
          {shirt}
        </button>
      ) : (
        <div className="flex w-[76px] flex-col items-center" title={tooltip}>
          {shirt}
        </div>
      );
    }

    const inner = (
      <>
        {shirtNumber !== undefined && (
          <span
            className={`font-display font-black leading-none ${
              interactive ? "text-theme-primary" : "text-theme-primary/50"
            } text-[11px] sm:text-xs md:text-sm`}
          >
            {shirtNumber}
          </span>
        )}
        <span
          className={`w-full text-center font-display font-semibold ${
            _compact || fullPlayerNames
              ? "line-clamp-2 px-0.5 text-[7.5px] leading-[1.1] sm:text-[8px]"
              : "text-[8px] font-bold uppercase leading-tight tracking-wide sm:text-[9px] md:text-[10px]"
          } ${
            interactive ? "text-white" : "text-white/40"
          }`}
        >
          {positionLabel}
        </span>
        {interactive && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-theme-primary sm:text-[10px] md:text-xs">
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
          aria-label={`${slot.label}: empty — tap to spin`}
          className={`${EMPTY_SLOT_BASE_CLASS} btn-press ${slotSizeClass} ${stateClass} outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50`}
        >
          {inner}
        </button>
      );
    }

    return (
      <div className={`${EMPTY_SLOT_BASE_CLASS} ${slotSizeClass} ${stateClass}`} title={tooltip}>
        {inner}
      </div>
    );
  }

  const card = interactive && onClick ? (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${slot.label}: change or remove player`}
      className={`btn-press select-none rounded-lg outline-none ring-2 focus-visible:ring-theme-primary/50 ${
        accent === "source"
          ? "ring-theme-primary"
          : accent === "target"
            ? "ring-accent-gold shadow-[0_0_12px_rgba(251,191,36,0.35)]"
            : selected
              ? "ring-accent-gold shadow-[0_0_16px_rgba(251,191,36,0.45)]"
              : "ring-transparent hover:ring-theme-primary/40"
      }`}
    >
      <PitchSlotCard
        slot={slot}
        hardMode={hardMode}
        clubColorOverride={clubColorOverride}
        compact={_compact}
        fullPlayerNames={fullPlayerNames}
        kitOverride={kitOverride}
      />
    </button>
  ) : (
    <PitchSlotCard
      slot={slot}
      hardMode={hardMode}
      clubColorOverride={clubColorOverride}
      compact={_compact}
      fullPlayerNames={fullPlayerNames}
      kitOverride={kitOverride}
    />
  );

  if (!animateEntrance) {
    return card;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {card}
    </motion.div>
  );
});
