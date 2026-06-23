"use client";

import type { Player, SquadSlot } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import { getPlacementPenalty } from "@/lib/game/position-placement";
import { DraftPositionsRemaining } from "./DraftPositionsRemaining";
import { CARD, HARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface DraftPositionPlacementProps {
  player: Player;
  squad: SquadSlot[];
  hardMode?: boolean;
  showRule?: boolean;
  onPlace: (slotIndex: number) => void;
  disabled?: boolean;
}

export function DraftPositionPlacement({
  player,
  squad,
  hardMode = false,
  showRule = false,
  onPlace,
  disabled = false,
}: DraftPositionPlacementProps) {
  const emptySlots = squad.filter((slot) => !slot.player);

  const panelClass = hardMode
    ? `${HARD.banner} ${SPACING.cardPadding}`
    : `${CARD.base} border-accent-green/30 bg-accent-green/5 ${SPACING.cardPadding}`;

  return (
    <div className={`mx-auto mb-4 max-w-2xl ${panelClass}`}>
      {showRule && (
        <div
          className={`mb-3 border-b border-pitch-600/40 pb-3 text-left ${TYPO.bodySm}`}
        >
          <p className={TYPO.sectionTitle}>Draft Mode</p>
          <p className="mt-1 text-gray-400">
            Pick a player from the pair offered, then choose where they play.
            Natural position = no penalty; out of position = −5 OVR. Scrum
            Half ↔ Stand Off and other compatible swaps are penalty-free.
          </p>
        </div>
      )}

      <p className={`text-center ${TYPO.sectionTitle}`}>Selected Player</p>
      <p className={`mt-1 text-center font-semibold text-white ${TYPO.body}`}>
        {player.name}
        <span className="font-normal text-gray-400">
          {" "}
          · {POSITION_LABELS[player.position]}
        </span>
      </p>

      <div className="mt-3">
        <DraftPositionsRemaining squad={squad} compact />
      </div>

      <p className={`mt-4 text-center ${TYPO.statLabel}`}>Choose Position</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {emptySlots.map((slot) => {
          const penalty = getPlacementPenalty(
            player.position,
            slot.position,
            player
          );
          const natural = penalty === 0 && player.position === slot.position;
          const compatible = penalty === 0 && !natural;

          return (
            <button
              key={slot.slotIndex}
              type="button"
              disabled={disabled}
              onClick={() => onPlace(slot.slotIndex)}
              className={`min-h-[40px] rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                penalty === 0
                  ? "border-accent-green/45 bg-accent-green/10 hover:bg-accent-green/20"
                  : "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
              }`}
            >
              <span className="block font-display text-xs font-bold uppercase tracking-wide text-white">
                {slot.label}
              </span>
              <span
                className={`mt-0.5 block text-[10px] font-medium ${
                  penalty === 0 ? "text-accent-green" : "text-amber-400"
                }`}
              >
                {natural
                  ? "Natural — no penalty"
                  : compatible
                    ? "Compatible — no penalty"
                    : hardMode
                      ? "Out of position"
                      : `−${penalty} OVR`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
