"use client";

import { useState } from "react";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import type { SeasonAward } from "@/lib/season-awards";
import type { SquadSlot } from "@/lib/types";
import { getFilledCount, getSquadValue, TOTAL_SLOTS } from "@/lib/positions";
import { CARD } from "@/lib/ui/design-system";
import { RugbyPitch } from "./RugbyPitch";
import { TeamSheetPlayerPopup } from "./TeamSheetPlayerPopup";

interface TeamSheetProps {
  squad: SquadSlot[];
  hardMode?: boolean;
  clubColorOverride?: string;
  interactive?: boolean;
  tryScorers?: PlayerTryTotal[];
  awards?: SeasonAward[];
  totalMatches?: number;
  statsScope?: "season" | "playoff";
}

export function TeamSheet({
  squad,
  hardMode = false,
  clubColorOverride,
  interactive = false,
  tryScorers,
  awards,
  totalMatches,
  statsScope = "season",
}: TeamSheetProps) {
  const [popupSlot, setPopupSlot] = useState<SquadSlot | null>(null);

  return (
    <>
      <div className={`${CARD.base} overflow-hidden p-3 sm:p-4`}>
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
          interactive={interactive}
          allowFilledSlotClick={interactive}
          onSlotClick={(slotIndex) => {
            const slot = squad.find((s) => s.slotIndex === slotIndex);
            if (slot?.player) setPopupSlot(slot);
          }}
        />
      </div>
      <TeamSheetPlayerPopup
        slot={popupSlot}
        hardMode={hardMode}
        clubColorOverride={clubColorOverride}
        tryScorers={tryScorers}
        awards={awards}
        totalMatches={totalMatches}
        statsScope={statsScope}
        onClose={() => setPopupSlot(null)}
      />
    </>
  );
}
