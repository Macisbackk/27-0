"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Player, Position } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { formatPlayerDisplayName } from "@/lib/players/prime-year";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { getClubColors } from "@/lib/clubs";
import { POSITION_LABELS } from "@/lib/positions";
import {
  getSlotRevealBio,
  type SlotTeamYearPlayer,
} from "@/lib/game/slot-team-year-pick";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { CARD, LINK } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SlotTeamYearPickerProps {
  target: SlotRevealTarget;
  slotLabel: string;
  slotPosition: Position;
  entries: SlotTeamYearPlayer[];
  onSelect: (player: Player) => void;
  onBack?: () => void;
  disabled?: boolean;
  hardMode?: boolean;
}

export function SlotTeamYearPicker({
  target,
  slotLabel,
  entries,
  onSelect,
  onBack,
  disabled,
  hardMode,
}: SlotTeamYearPickerProps) {
  const bio = useMemo(
    () => getSlotRevealBio(target.team, target.year),
    [target.team, target.year]
  );

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className={`mb-4 ${LINK.subtle} disabled:opacity-40`}
        >
          ← Back to team sheet
        </button>
      )}

      <header className="mb-4 border-b border-pitch-600/40 pb-3 text-center">
        <p className={TYPO.sectionLabel}>{slotLabel}</p>
        <h2 className="mt-1 font-display text-lg font-bold text-white sm:text-xl">
          {target.team}{" "}
          <span className="text-accent-green">{target.year}</span>
        </h2>
        <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-gray-400`}>
          {bio}
        </p>
      </header>

      <div className="mx-auto w-full max-w-2xl">
        <p className={`mb-2 ${TYPO.bodySm} text-gray-500`}>
          {entries.length} player{entries.length !== 1 ? "s" : ""} available ·
          tap to sign
        </p>

        {entries.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No players available from this squad.
          </p>
        ) : (
          <ul className="flex max-h-[min(50vh,480px)] flex-col gap-2 overflow-y-auto overflow-x-hidden pr-0.5">
            {entries.map(({ player, tier }) => {
              const colorClub = getPlayerColorClub(player);
              const colors = getClubColors(colorClub);
              const displayName = formatPlayerDisplayName(player);
              const positionLabel = POSITION_LABELS[player.position];
              const tierNote =
                tier === "exact"
                  ? null
                  : tier === "compatible"
                    ? "Compatible"
                    : "Out of position";

              return (
                <li key={player.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      playUiClick();
                      playPlayerSelect();
                      onSelect(player);
                    }}
                    className={`btn-press ${CARD.base} flex w-full min-w-0 items-center gap-2 px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:py-3.5`}
                    style={{
                      boxShadow: `inset 3px 0 0 ${colors.primary}`,
                    }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-bold leading-snug text-white">
                        {displayName}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-gray-500 sm:text-xs">
                        {positionLabel}
                        {tierNote ? ` · ${tierNote}` : ""}
                      </span>
                    </span>
                    {!hardMode && (
                      <>
                        <span className="shrink-0 text-center text-[10px] font-semibold text-gray-300 sm:text-xs">
                          {player.peakRating}
                          <span className="block text-[9px] font-medium text-gray-500">
                            OVR
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-accent-green sm:text-xs">
                          {formatValue(player.value)}
                        </span>
                      </>
                    )}
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-accent-green">
                      Sign
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
