"use client";

import type { Player } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { PlayerCard } from "./PlayerCard";
import {
  PlayerStatusBadge,
  resolvePlayerStatus,
} from "./cards/PlayerStatusBadge";
import { CARD } from "@/lib/ui/design-system";

interface SlotRecruitPlayerCardProps {
  player: Player;
  hardMode?: boolean;
  clubColorOverride?: string;
}

/** Normal Mode pick card — matches Fantasy picker layout; team colour is primary accent. */
export function SlotRecruitPlayerCard({
  player,
  hardMode,
  clubColorOverride,
}: SlotRecruitPlayerCardProps) {
  const colors = getClubColors(clubColorOverride ?? player.club);
  const status = resolvePlayerStatus(player);

  return (
    <div
      className={`${CARD.base} flex h-full min-w-0 flex-col overflow-hidden transition hover:border-accent-green/35`}
      style={{
        boxShadow: `inset 3px 0 0 ${colors.primary}`,
      }}
    >
      <div className="mb-1 flex items-center justify-between px-1 pt-1">
        <span className="font-display text-[8px] font-bold uppercase tracking-wider text-gray-500 sm:text-[10px]">
          Sign
        </span>
        {status && (
          <PlayerStatusBadge
            status={status}
            compact
            className="!mt-0 shrink-0 scale-[0.78] origin-top-right sm:scale-[0.85]"
          />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-0.5 pb-1">
        <PlayerCard
          player={player}
          selectable
          hardMode={hardMode}
          equalHeight
          compactMobile
        />
      </div>
    </div>
  );
}
