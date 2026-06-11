"use client";

import type { Player, Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import type { SquadSlot } from "@/lib/types";
import { getPlacementPenalty } from "@/lib/game/position-placement";
import { DraftPositionsRemaining } from "./DraftPositionsRemaining";
import { CARD, HARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface DraftPlacementBannerProps {
  player: Player;
  squad: SquadSlot[];
  selectedSlotPosition?: Position;
  hardMode?: boolean;
  showRule?: boolean;
}

export function DraftPlacementBanner({
  player,
  squad,
  selectedSlotPosition,
  hardMode = false,
  showRule = false,
}: DraftPlacementBannerProps) {
  const penalty =
    selectedSlotPosition !== undefined
      ? getPlacementPenalty(player.position, selectedSlotPosition)
      : 0;

  const bannerClass = hardMode
    ? `${HARD.banner} ${SPACING.cardPadding}`
    : `${CARD.base} border-accent-green/30 bg-accent-green/5 ${SPACING.cardPadding}`;

  return (
    <div className={`mx-auto mb-4 max-w-2xl text-center ${bannerClass}`}>
      {showRule && (
        <div className={`mb-3 border-b border-pitch-600/40 pb-3 text-left ${TYPO.bodySm}`}>
          <p className={TYPO.sectionTitle}>Draft Mode Rule</p>
          <p className="mt-1">
            Pick a player from the pair offered, then tap an empty slot on the
            team sheet. No penalty at natural position; −5 OVR if out of
            position. Repeat until your squad is full.
          </p>
          <p className="mt-1 text-gray-500">
            Compatible swaps (no penalty): Wing/Full Back, Stand Off/Scrum Half,
            Prop/Second Row.
          </p>
        </div>
      )}

      {hardMode && (
        <p className={`mb-2 ${TYPO.sectionTitle} ${HARD.reviewAccent}`}>
          Hard Draft — ratings hidden
        </p>
      )}

      <p className={TYPO.sectionTitle}>Selected Player</p>
      <p className={`mt-1 font-semibold text-white ${TYPO.body}`}>
        {player.name}
        <span className="font-normal text-gray-400">
          {" "}
          · {POSITION_LABELS[player.position]}
        </span>
      </p>

      <div className="mt-3">
        <DraftPositionsRemaining squad={squad} compact />
      </div>

      <p className={`mt-3 ${TYPO.bodySm} text-amber-300/90`}>
        Out-of-position players lose 5 OVR for this run.
      </p>

      {selectedSlotPosition !== undefined && (
        <>
          <p className={`mt-1 ${TYPO.body}`}>
            Slot:{" "}
            <span className={TYPO.positionHighlight}>
              {POSITION_LABELS[selectedSlotPosition]}
            </span>
          </p>
          {penalty > 0 ? (
            <p className="mt-2 text-sm font-semibold text-amber-400">
              {hardMode
                ? "Out of position penalty applied."
                : `Penalty: -${penalty} OVR`}
            </p>
          ) : (
            <p className={`mt-2 ${TYPO.body} text-accent-green`}>
              No OVR penalty.
            </p>
          )}
        </>
      )}

      {!selectedSlotPosition && (
        <p className={`mt-2 ${TYPO.bodySm}`}>
          Tap an empty slot on the team sheet to place this player.
        </p>
      )}
    </div>
  );
}
