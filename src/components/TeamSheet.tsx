"use client";

import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import {
  getFormationSlotDisplayLabel,
  POSITION_TILE_LABEL,
} from "@/lib/positions";
import { getSlotDisplayInfo } from "@/lib/squad-display";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const TEAM_SHEET_ROWS: number[][] = [
  [0],
  [1, 3, 4, 2],
  [5, 6],
  [7, 8, 9],
  [10, 12],
  [11],
];

interface TeamSheetProps {
  squad: SquadSlot[];
  hardMode?: boolean;
  clubColorOverride?: string;
}

function slotByIndex(squad: SquadSlot[], slotIndex: number): SquadSlot | undefined {
  return squad.find((slot) => slot.slotIndex === slotIndex);
}

function TeamSheetSlot({
  slot,
  hardMode,
  clubColorOverride,
}: {
  slot: SquadSlot;
  hardMode?: boolean;
  clubColorOverride?: string;
}) {
  const player = slot.player;
  const positionLabel = getFormationSlotDisplayLabel(slot.slotIndex);
  const tileLabel = POSITION_TILE_LABEL[slot.position];

  if (!player) {
    return (
      <div className="min-h-[4.5rem] rounded-lg border border-dashed border-pitch-600/60 bg-pitch-950/40 px-2 py-2 text-center">
        <p className={`${TYPO.sectionLabel} text-[10px]`}>{tileLabel}</p>
        <p className="mt-1 text-xs text-gray-500">{positionLabel}</p>
      </div>
    );
  }

  const colorClub = clubColorOverride ?? getPlayerColorClub(player);
  const colors = getClubColors(colorClub);
  const display = getSlotDisplayInfo(slot);
  const showRating = !hardMode && display;

  return (
    <div
      className="min-h-[4.5rem] rounded-lg border border-pitch-600/50 bg-pitch-900/50 px-2 py-2 text-center"
      style={{ boxShadow: `inset 3px 0 0 ${colors.primary}` }}
    >
      <p className={`${TYPO.sectionLabel} text-[10px] text-gray-400`}>
        {tileLabel}
      </p>
      <p className="mt-0.5 truncate font-display text-sm font-bold text-white">
        {formatPlayerDisplayName(player)}
      </p>
      {showRating && (
        <p className="mt-0.5 text-xs font-semibold text-accent-green">
          {display.ratingCompact}
        </p>
      )}
      {display?.positionMismatch && (
        <p className="mt-0.5 truncate text-[10px] text-gray-500">
          {display.positionCompact}
        </p>
      )}
    </div>
  );
}

export function TeamSheet({
  squad,
  hardMode = false,
  clubColorOverride,
}: TeamSheetProps) {
  return (
    <div className={`${CARD.base} ${SPACING.cardPaddingSm}`}>
      <div className="space-y-2">
        {TEAM_SHEET_ROWS.map((row, rowIndex) => {
          const cols = row.length;
          return (
            <div
              key={rowIndex}
              className={`grid gap-2 ${
                cols === 1
                  ? "grid-cols-1 max-w-xs mx-auto"
                  : cols === 2
                    ? "grid-cols-2 max-w-md mx-auto"
                    : cols === 3
                      ? "grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {row.map((slotIndex) => {
                const slot = slotByIndex(squad, slotIndex);
                if (!slot) return null;
                return (
                  <TeamSheetSlot
                    key={slotIndex}
                    slot={slot}
                    hardMode={hardMode}
                    clubColorOverride={clubColorOverride}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
