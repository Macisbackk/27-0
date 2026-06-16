"use client";

import type { SquadSlot } from "@/lib/types";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { RugbyPitch } from "./RugbyPitch";

interface TeamSheetProps {
  squad: SquadSlot[];
  hardMode?: boolean;
  clubColorOverride?: string;
}

export function TeamSheet({
  squad,
  hardMode = false,
  clubColorOverride,
}: TeamSheetProps) {
  return (
    <div className={`${CARD.base} ${SPACING.cardPaddingSm} overflow-hidden`}>
      <RugbyPitch
        squad={squad}
        totalValue={getSquadValue(squad)}
        filledCount={getFilledCount(squad)}
        totalSlots={TOTAL_SLOTS}
        hardMode={hardMode}
        formationOnly
        compact
        hideValueSummary
        clubColorOverride={clubColorOverride}
      />
    </div>
  );
}
