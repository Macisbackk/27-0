"use client";

import type { Player, SquadSlot } from "@/lib/types";
import { getNaturalPlacementSlots } from "@/lib/game/position-placement";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import {
  getFormationSlotDisplayLabel,
  POSITION_LABELS,
} from "@/lib/positions";
import { playUiClick } from "@/lib/sound";
import { BTN, CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SlotRecruitPlacementConfirmProps {
  player: Player;
  squad: SquadSlot[];
  onConfirm: (slotIndex: number) => void;
  onBack?: () => void;
  disabled?: boolean;
}

export function SlotRecruitPlacementConfirm({
  player,
  squad,
  onConfirm,
  onBack,
  disabled,
}: SlotRecruitPlacementConfirmProps) {
  const slots = getNaturalPlacementSlots(squad, player);
  const targetSlot = slots[0];

  if (!targetSlot) {
    return (
      <div className={`${CARD.panel} mb-4 p-4 text-center`}>
        <p className={TYPO.bodySm}>No valid position available for this player.</p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={`mt-3 ${BTN.base} ${BTN.secondary}`}
          >
            Back
          </button>
        )}
      </div>
    );
  }

  const slotLabel = getFormationSlotDisplayLabel(targetSlot.slotIndex);
  const positionLabel = POSITION_LABELS[player.position];
  const displayName = formatPlayerDisplayName(player);

  return (
    <div className={`${CARD.panel} mb-4 border border-accent-green/25 p-4 sm:p-5`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className={`mb-3 text-sm text-gray-400 hover:text-white disabled:opacity-40`}
        >
          ← Back to player list
        </button>
      )}
      <p className={TYPO.sectionLabel}>Confirm placement</p>
      <p className="mt-2 font-display text-lg font-bold text-white">
        Place {displayName} at {slotLabel}?
      </p>
      <p className={`mt-1 ${TYPO.bodySm} text-gray-400`}>
        Natural position: {positionLabel}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          playUiClick();
          onConfirm(targetSlot.slotIndex);
        }}
        className={`mt-4 w-full ${BTN.theme}`}
      >
        Confirm Placement
      </button>
    </div>
  );
}
