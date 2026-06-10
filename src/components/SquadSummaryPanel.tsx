"use client";

import type { SquadSlot } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/positions";
import { getSlotDisplayInfo } from "@/lib/squad-display";
import { formatValue } from "@/lib/players";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";

interface SquadSummaryPanelProps {
  squad: SquadSlot[];
  revealRatings?: boolean;
}

export function SquadSummaryPanel({
  squad,
  revealRatings = true,
}: SquadSummaryPanelProps) {
  const players = squad
    .filter((s) => s.player)
    .sort((a, b) => a.slotIndex - b.slotIndex);

  if (players.length === 0) return null;

  return (
    <div className={`${RL_INFO_BOX_CLASS} space-y-2 p-3`}>
      {players.map((slot) => {
        const player = slot.player!;
        const info = getSlotDisplayInfo(slot);
        if (!info) return null;

        return (
          <div
            key={slot.slotIndex}
            className="rounded-lg border border-pitch-700/50 bg-pitch-950/60 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-white">{player.name}</p>
              <span className="text-xs text-gray-500">{slot.label}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {info.positionMismatch ? (
                <>
                  {POSITION_LABELS[info.naturalPosition]} →{" "}
                  {POSITION_LABELS[info.playedPosition]}
                </>
              ) : (
                POSITION_LABELS[info.playedPosition]
              )}
            </p>
            {revealRatings && (
              <p className="mt-1 text-xs">
                <span className="font-display font-bold text-accent-green">
                  {info.ratingAdjusted
                    ? `${info.originalRating} → ${info.adjustedRating} OVR`
                    : `${info.adjustedRating} OVR`}
                </span>
                <span className="mx-2 text-gray-600">·</span>
                <span className="text-accent-gold">
                  {formatValue(player.value)}
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
