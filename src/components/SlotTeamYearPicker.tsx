"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClubLogoBox } from "@/components/ClubBadge";
import { GameButton } from "@/components/ui/GameButton";
import type { Player } from "@/lib/types";
import { formatShortYear } from "@/lib/players/prime-year";
import { getClubColors } from "@/lib/clubs";
import {
  getSlotRevealBio,
  type SlotTeamYearPlayer,
} from "@/lib/game/slot-team-year-pick";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { CARD, LINK, SPACING } from "@/lib/ui/design-system";
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

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => b.player.peakRating - a.player.peakRating),
    [entries]
  );
  const topRating = sortedEntries[0]?.player.peakRating ?? 0;

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <div
        className={`${CARD.elevated} overflow-hidden border border-pitch-600/50`}
        style={{
          boxShadow: `inset 4px 0 0 ${clubColors.primary}`,
        }}
      >
        <div
          className="border-b border-pitch-700/50 px-4 py-4 sm:px-6 sm:py-5"
          style={{
            background: `linear-gradient(135deg, ${clubColors.primary}1a 0%, transparent 55%)`,
          }}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={disabled}
              className={`mb-3 ${LINK.subtle} disabled:opacity-40`}
            >
              ← Back to team sheet
            </button>
          )}

          <div className="flex items-start gap-3 sm:gap-4">
            <ClubLogoBox
              club={target.team}
              size="md"
              showAbbrev={false}
              className="hidden shrink-0 sm:flex"
            />
            <ClubLogoBox
              club={target.team}
              size="sm"
              showAbbrev={false}
              className="shrink-0 sm:hidden"
            />
            <div className="min-w-0 flex-1">
              <p className={TYPO.sectionLabel}>Pick your signing</p>
              <h2 className="mt-0.5 font-display text-lg font-bold leading-tight text-white sm:text-2xl">
                {target.team}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-accent-green/35 bg-accent-green/12 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-accent-green">
                  {shortYear}
                </span>
                <span className="rounded-lg border border-pitch-600/60 bg-pitch-950/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-300">
                  {entries.length} available
                </span>
              </div>
            </div>
            {onRespin && (
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onRespin();
                }}
                disabled={disabled || respinsRemaining <= 0}
                className="shrink-0 rounded-lg border border-pitch-600 bg-pitch-900/90 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:border-accent-green/45 hover:bg-pitch-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
              >
                {respinsRemaining > 0
                  ? `Respin ${respinsRemaining}/${maxRespins}`
                  : "No respins"}
              </button>
            )}
          </div>

          <p
            className={`mt-3 rounded-lg border border-pitch-700/50 bg-pitch-950/55 px-3 py-2.5 ${TYPO.bodySm} leading-relaxed text-gray-400`}
          >
            {bio}
          </p>
        </div>

        <div className={`${SPACING.cardPadding} pt-4 sm:pt-5`}>
          {entries.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <>
              <p className={`mb-3 text-center ${TYPO.bodySm} text-gray-500`}>
                Tap <span className="font-semibold text-accent-green">Sign player</span>{" "}
                to add them to your squad
              </p>
              <div className="mx-auto grid max-h-[min(58vh,520px)] max-w-5xl grid-cols-1 gap-3 overflow-y-auto overflow-x-hidden pr-0.5 min-[520px]:grid-cols-3 sm:gap-4">
                {sortedEntries.map(({ player }, index) => {
                  const statsExpanded = statsPlayerId === player.id;
                  const isTopPick =
                    !hardMode &&
                    player.peakRating === topRating &&
                    sortedEntries.length > 1;

                  return (
                    <motion.div
                      key={player.id}
                      className={`relative min-w-0 ${
                        statsExpanded ? "min-[520px]:col-span-3" : ""
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: index * 0.06 }}
                    >
                      <SlotRecruitPlayerCard
                        player={player}
                        teamYearLabel={teamYearLabel}
                        hardMode={hardMode}
                        clubColorOverride={target.team}
                        statsExpanded={statsExpanded}
                        topPick={isTopPick}
                        disabled={disabled}
                        onSelect={() => {
                          playPlayerSelect();
                          onSelect(player);
                        }}
                        onToggleStats={() => {
                          playUiClick();
                          setStatsPlayerId((id) =>
                            id === player.id ? null : player.id
                          );
                        }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
