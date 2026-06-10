"use client";

import type { Player, Position } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import {
  getPlacementPenalty,
  isNaturalPlacement,
  OUT_OF_POSITION_PENALTY,
} from "@/lib/game/position-placement";

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

  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-accent-green/30 bg-accent-green/5 px-4 py-3 text-center">
      {showRule && (
        <div className="mb-3 border-b border-pitch-600/40 pb-3 text-left text-xs text-gray-400">
          <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-green">
            Draft Mode Rule
          </p>
          <p className="mt-1">
            You can place players in any empty position. Players used out of
            position lose {OUT_OF_POSITION_PENALTY} rating points for this run.
          </p>
          <p className="mt-1 text-gray-500">
            Compatible swaps (no penalty): Wing/Full Back, Stand Off/Scrum Half,
            Second Row/Loose Forward, Prop/Hooker.
          </p>
        </div>
      )}

      <p className="font-display text-xs font-bold uppercase tracking-wider text-accent-green">
        Place {player.name}
      </p>
      <p className="mt-1 text-sm text-gray-300">
        Natural Position:{" "}
        <span className="font-semibold text-white">
          {POSITION_LABELS[player.position]}
        </span>
      </p>

      {selectedSlotPosition !== undefined && (
        <>
          <p className="mt-1 text-sm text-gray-300">
            Selected Position:{" "}
            <span className="font-semibold text-white">
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
            <p className="mt-2 text-sm text-accent-green">
              {isNaturalPlacement(player.position, selectedSlotPosition)
                ? "Natural position — no penalty."
                : "Compatible position — no penalty."}
            </p>
          )}
        </>
      )}

      {!selectedSlotPosition && (
        <p className="mt-2 text-xs text-gray-500">
          Tap an empty slot on the team sheet to place this player.
        </p>
      )}
    </div>
  );
}
