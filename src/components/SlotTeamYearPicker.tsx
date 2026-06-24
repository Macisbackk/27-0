"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Player } from "@/lib/types";
import { formatShortYear } from "@/lib/players/prime-year";
import { getClubColors } from "@/lib/clubs";
import {
  getSlotRevealBio,
  type SlotTeamYearPlayer,
} from "@/lib/game/slot-team-year-pick";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { playPlayerSelect } from "@/lib/sound";
import { CARD, LINK } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { SlotRecruitPlayerCard } from "./SlotRecruitPlayerCard";

interface SlotTeamYearPickerProps {
  target: SlotRevealTarget;
  entries: SlotTeamYearPlayer[];
  onSelect: (player: Player) => void;
  onBack?: () => void;
  onRespin?: () => void;
  respinsRemaining?: number;
  maxRespins?: number;
  disabled?: boolean;
  hardMode?: boolean;
}

export function SlotTeamYearPicker({
  target,
  entries,
  onSelect,
  onBack,
  onRespin,
  respinsRemaining = 0,
  maxRespins = 3,
  disabled,
  hardMode,
}: SlotTeamYearPickerProps) {
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);

  const bio = useMemo(
    () => getSlotRevealBio(target.team, target.year),
    [target.team, target.year]
  );
  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );
  const shortYear = formatShortYear(target.year);
  const teamYearLabel = `${target.team} ${shortYear}`;

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
              <p className={TYPO.sectionLabel}>Choose your signing</p>
              <h2 className="mt-0.5 font-display text-base font-bold text-white sm:text-lg">
                {target.team}{" "}
                <span className="text-accent-green">{shortYear}</span>
              </h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-green">
                {entries.length} available
              </span>
              {onRespin && (
                <button
                  type="button"
                  onClick={onRespin}
                  disabled={disabled || respinsRemaining <= 0}
                  className="rounded-md border border-pitch-600 bg-pitch-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:border-accent-green/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {respinsRemaining > 0
                    ? `Respin · ${respinsRemaining}/${maxRespins}`
                    : "No respins left"}
                </button>
              )}
            </div>
          </div>
          <p
            className={`mt-2 rounded-md border border-accent-green/15 bg-pitch-950/60 px-2.5 py-2 ${TYPO.bodySm} leading-relaxed text-gray-400`}
          >
            {bio}
          </p>
        </div>

        <div className="px-2 py-2 sm:px-3 sm:py-3">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <div className="mx-auto grid max-h-[min(52vh,480px)] max-w-4xl grid-cols-1 gap-2 overflow-y-auto overflow-x-hidden pr-0.5 min-[480px]:grid-cols-3 sm:gap-3">
              {entries.map(({ player }) => {
                const statsExpanded = statsPlayerId === player.id;

                return (
                  <div
                    key={player.id}
                    className={`relative min-w-0 ${
                      statsExpanded ? "col-span-2 sm:col-span-3" : ""
                    }`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <SlotRecruitPlayerCard
                        player={player}
                        teamYearLabel={teamYearLabel}
                        hardMode={hardMode}
                        clubColorOverride={target.team}
                        statsExpanded={statsExpanded}
                        disabled={disabled}
                        onSelect={() => {
                          playPlayerSelect();
                          onSelect(player);
                        }}
                        onToggleStats={() => {
                          setStatsPlayerId((id) =>
                            id === player.id ? null : player.id
                          );
                        }}
                      />
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
