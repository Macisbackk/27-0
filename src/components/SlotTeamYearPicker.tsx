"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Player, Position } from "@/lib/types";
import { formatValue } from "@/lib/players";
import {
  formatPlayerDisplayName,
  formatPrimeYearSuffix,
} from "@/lib/players/prime-year";
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
  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
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

      <div
        className={`${CARD.panel} overflow-hidden border border-pitch-600/50`}
        style={{
          boxShadow: `inset 3px 0 0 ${clubColors.primary}`,
        }}
      >
        <div
          className="border-b border-pitch-700/50 px-4 py-3 sm:px-5"
          style={{
            background: `linear-gradient(180deg, ${clubColors.primary}14 0%, transparent 100%)`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={TYPO.sectionLabel}>Sign for {slotLabel}</p>
              <h2 className="mt-0.5 font-display text-base font-bold text-white sm:text-lg">
                {target.team}{" "}
                <span className="text-accent-green">{target.year}</span>
              </h2>
            </div>
            <span className="shrink-0 rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-green">
              {entries.length} available
            </span>
          </div>
          <p
            className={`mt-2 rounded-md border border-accent-green/15 bg-pitch-950/60 px-2.5 py-2 ${TYPO.bodySm} leading-relaxed text-gray-400`}
          >
            {bio}
          </p>
        </div>

        <div className="px-3 py-3 sm:px-4 sm:py-4">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <ul className="mx-auto flex max-h-[min(48vh,440px)] max-w-2xl flex-col gap-2 overflow-y-auto overflow-x-hidden pr-0.5">
              {entries.map(({ player, tier }) => {
                const colorClub = getPlayerColorClub(player);
                const colors = getClubColors(colorClub);
                const displayName = formatPlayerDisplayName(player);
                const positionLabel = POSITION_LABELS[player.position];
                const primeBadge =
                  player.category !== "current" && player.primeYear !== undefined
                    ? formatPrimeYearSuffix(player.primeYear)
                    : null;
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
                      className={`btn-press group flex w-full min-w-0 items-center gap-2 rounded-xl border border-pitch-600/50 bg-pitch-900/50 px-3 py-2.5 text-left transition hover:border-accent-green/35 hover:bg-pitch-800/60 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:py-3`}
                      style={{
                        boxShadow: `inset 3px 0 0 ${colors.primary}`,
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: colors.primary }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                          <span className="font-display text-sm font-bold leading-snug text-white sm:text-base">
                            {displayName}
                          </span>
                          {primeBadge && (
                            <span className="text-[10px] font-semibold text-gray-500">
                              {primeBadge}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-gray-500 sm:text-xs">
                          {positionLabel}
                          {tierNote ? ` · ${tierNote}` : ""}
                        </span>
                      </span>
                      {!hardMode && (
                        <>
                          <span className="shrink-0 min-w-[2.25rem] text-center text-xs font-bold text-white">
                            {player.peakRating}
                            <span className="block text-[9px] font-medium text-gray-500">
                              OVR
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-xs font-semibold text-accent-green sm:block">
                            {formatValue(player.value)}
                          </span>
                        </>
                      )}
                      <span
                        className={`shrink-0 rounded-md border border-accent-green/40 bg-accent-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-green transition group-hover:bg-accent-green/20 sm:text-[11px]`}
                      >
                        Sign
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}
