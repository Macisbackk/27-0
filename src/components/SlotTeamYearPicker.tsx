"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClubLogoBox } from "@/components/ClubBadge";
import type { Player } from "@/lib/types";
import { formatShortYear } from "@/lib/players/prime-year";
import { getClubColors } from "@/lib/clubs";
import type { SlotTeamYearPlayer } from "@/lib/game/slot-team-year-pick";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { CARD, LINK } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  QuickModePlayerChoiceCard,
  quickPlayerChoiceGridClass,
} from "./QuickModePlayerChoiceCard";
import { GameButton } from "@/components/ui/GameButton";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { EraRatingExplanation } from "./EraRatingExplanation";
import { CurrentRatingExplanation } from "./CurrentRatingExplanation";

interface SlotTeamYearPickerProps {
  target: SlotRevealTarget;
  entries: SlotTeamYearPlayer[];
  onSelect: (player: Player) => void;
  onBack?: () => void;
  onRespin?: () => boolean | void;
  respinsRemaining?: number;
  /** Retained for callers; count is shown only on the shared Respin button. */
  maxRespins?: number;
  disabled?: boolean;
  hardMode?: boolean;
  boosted?: boolean;
  eraMode?: boolean;
}

export function SlotTeamYearPicker({
  target,
  entries,
  onSelect,
  onBack,
  onRespin,
  respinsRemaining = 0,
  disabled,
  hardMode,
  boosted = false,
  eraMode = false,
}: SlotTeamYearPickerProps) {
  const [respinLocked, setRespinLocked] = useState(false);

  useEffect(() => {
    setRespinLocked(false);
  }, [entries]);

  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );
  const shortYear = formatShortYear(target.year);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => b.player.peakRating - a.player.peakRating),
    [entries]
  );
  const topRating = sortedEntries[0]?.player.peakRating ?? 0;
  const choiceCount = sortedEntries.length;

  const canRespin =
    !!onRespin && !disabled && respinsRemaining > 0 && !respinLocked;
  const showRespin = !!onRespin && !hardMode;
  const respinLabel =
    respinsRemaining > 0
      ? `Respin (${respinsRemaining})`
      : "No respins";

  const handleRespin = () => {
    if (!canRespin || !onRespin) return;
    setRespinLocked(true);
    playUiClick();
    const ok = onRespin();
    // Failed boosted respins leave entries unchanged — unlock so the player is not stuck.
    if (ok === false) {
      setRespinLocked(false);
    }
  };

  return (
    <motion.div
      className="w-full min-w-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <div className={`${CARD.elevated} game-panel--flush overflow-hidden`}>
        <TeamColourStrip club={target.team} />
        <div
          className="border-b border-pitch-700/40 px-3 py-2.5 sm:px-6 sm:py-4"
          style={{
            background: `linear-gradient(180deg, ${clubColors.primary}14 0%, transparent 70%)`,
          }}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={disabled}
              className={`mb-2 ${LINK.subtle} disabled:opacity-40`}
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
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/10 bg-pitch-950/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-theme-primary">
                  {shortYear}
                </span>
                <span className="rounded-md border border-white/10 bg-pitch-950/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  {entries.length} available
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pt-2 pb-3 sm:px-6 sm:pt-4 sm:pb-4">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <>
              {eraMode ? (
                <EraRatingExplanation compact className="mb-1.5 px-1" />
              ) : (
                <CurrentRatingExplanation compact className="mb-1.5 px-1" />
              )}
              <div className={quickPlayerChoiceGridClass(choiceCount)}>
                {sortedEntries.map(({ player }, index) => {
                  const isTopPick =
                    !hardMode &&
                    player.peakRating === topRating &&
                    sortedEntries.length > 1;

                  return (
                    <motion.div
                      key={player.id}
                      className="h-full min-w-0 w-full"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: index * 0.06 }}
                    >
                      <QuickModePlayerChoiceCard
                        player={player}
                        choiceLabel={isTopPick ? "Top rating" : undefined}
                        hardMode={hardMode}
                        ratingVisible={!hardMode}
                        clubOverride={target.team}
                        clubColorOverride={target.team}
                        topPick={isTopPick}
                        boosted={boosted}
                        disabled={disabled}
                        selectLabel="Select"
                        onSelect={() => {
                          playPlayerSelect();
                          onSelect(player);
                        }}
                      />
                    </motion.div>
                  );
                })}
              </div>
              {showRespin ? (
                <div className="mt-3 flex justify-center">
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    disabled={!canRespin}
                    onClick={handleRespin}
                    className="min-w-[8.5rem]"
                  >
                    {respinLabel}
                  </GameButton>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
