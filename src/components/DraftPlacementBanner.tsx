"use client";

import type { Player, Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import {
  getPlacementPenalty,
  isNaturalPlacement,
} from "@/lib/game/position-placement";
import { CARD, HARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface DraftPlacementBannerProps {
  player: Player;
  selectedSlotPosition?: Position;
  hardMode?: boolean;
  showRule?: boolean;
}

export function DraftPlacementBanner({
  player,
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
            Second Row/Loose Forward, Prop/Hooker.
          </p>
        </div>
      )}

      {hardMode && (
        <p className={`mb-2 ${TYPO.sectionTitle} ${HARD.reviewAccent}`}>
          Hard Draft — ratings hidden
        </p>
      )}

      <p className={TYPO.sectionTitle}>
        Place {player.name}
      </p>
      <p className={`mt-1 ${TYPO.body}`}>
        Natural Position:{" "}
        <span className={TYPO.positionHighlight}>
          {POSITION_LABELS[player.position]}
        </span>
      </p>

      {selectedSlotPosition !== undefined && (
        <>
          <p className={`mt-1 ${TYPO.body}`}>
            Selected Position:{" "}
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
              {isNaturalPlacement(player.position, selectedSlotPosition)
                ? "Natural position — no penalty."
                : "Compatible position — no penalty."}
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
