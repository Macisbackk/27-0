"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClubLogoBox } from "@/components/ClubBadge";
import { GameButton } from "@/components/ui/GameButton";
import type { Player } from "@/lib/types";
import { formatShortYear } from "@/lib/players/prime-year";
import { getClubColors } from "@/lib/clubs";
import type { SlotTeamYearPlayer } from "@/lib/game/slot-team-year-pick";
import type { SlotRevealTarget } from "@/lib/game/recruitment-slot-reveal";
import { playPlayerSelect, playUiClick } from "@/lib/sound";
import { CARD, LINK, MOBILE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { StickyActionBar } from "@/components/ui/MobileLayout";
import {
  QuickModePlayerChoiceCard,
  quickPlayerChoiceGridClass,
} from "./QuickModePlayerChoiceCard";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { EraRatingExplanation } from "./EraRatingExplanation";

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
  maxRespins = 3,
  disabled,
  hardMode,
  boosted = false,
  eraMode = false,
}: SlotTeamYearPickerProps) {
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [respinLocked, setRespinLocked] = useState(false);

  const clubColors = useMemo(
    () => getClubColors(target.team),
    [target.team]
  );
  const shortYear = formatShortYear(target.year);
  const parsedYear = Number.parseInt(target.year, 10);
  const selectedSeasonYear = Number.isFinite(parsedYear)
    ? parsedYear
    : undefined;

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => b.player.peakRating - a.player.peakRating),
    [entries]
  );
  const topRating = sortedEntries[0]?.player.peakRating ?? 0;
  const choiceCount = sortedEntries.length;

  const handleRespin = () => {
    if (!onRespin || disabled || respinsRemaining <= 0 || respinLocked) return;
    setRespinLocked(true);
    playUiClick();
    onRespin();
  };

  return (
    <motion.div
      className="w-full min-w-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <div
        className={`${CARD.elevated} game-panel--flush overflow-hidden`}
        style={{
          boxShadow: `inset 3px 0 0 ${clubColors.primary}`,
        }}
      >
        <div
          className="border-b border-pitch-700/40 px-3 py-3 sm:px-6 sm:py-4"
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
                <span className="rounded-md border border-white/10 bg-pitch-950/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-theme-primary">
                  {shortYear}
                </span>
                <span className="rounded-md border border-white/10 bg-pitch-950/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-300">
                  {entries.length} available
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`px-3 pt-2 sm:px-6 sm:pt-4 ${onRespin ? MOBILE.actionBarPad : ""}`}
        >
          {entries.length === 0 ? (
            <p className="py-10 text-center text-gray-500">
              No players available from this squad.
            </p>
          ) : (
            <>
              {eraMode ? (
                <EraRatingExplanation compact className="mb-2" />
              ) : (
                <p className={`mb-3 text-center ${TYPO.meta}`}>
                  Tap{" "}
                  <span className="font-semibold text-theme-primary">
                    Select Player
                  </span>{" "}
                  to add them
                </p>
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
                        selectLabel="Select Player"
                        showDetailsAction={!hardMode}
                        onSelect={() => {
                          playPlayerSelect();
                          onSelect(player);
                        }}
                        onViewDetails={
                          hardMode
                            ? undefined
                            : () => {
                                playUiClick();
                                setDetailPlayer(player);
                              }
                        }
                      />
                    </motion.div>
                  );
                })}
              </div>

              {onRespin && (
                <>
                  <div className="mx-auto mt-5 hidden w-full max-w-md flex-col items-center gap-2 sm:flex">
                    <GameButton
                      variant="secondary"
                      size="md"
                      fullWidth
                      disabled={
                        disabled || respinsRemaining <= 0 || respinLocked
                      }
                      onClick={handleRespin}
                    >
                      {respinsRemaining > 0
                        ? `Respin — ${respinsRemaining} remaining`
                        : "No respins remaining"}
                    </GameButton>
                    <p className={`${TYPO.meta} text-center`}>
                      {maxRespins} respins per run · does not use a draft pick
                    </p>
                  </div>
                  <StickyActionBar portal>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      className="min-h-[var(--mobile-tap-target)] flex-1"
                      disabled={
                        disabled || respinsRemaining <= 0 || respinLocked
                      }
                      onClick={handleRespin}
                    >
                      {respinsRemaining > 0
                        ? `Respin (${respinsRemaining})`
                        : "No respins"}
                    </GameButton>
                  </StickyActionBar>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {detailPlayer && (
        <PlayerDetailModal
          player={detailPlayer}
          ratingContext={eraMode ? "season" : undefined}
          seasonYear={eraMode ? selectedSeasonYear : undefined}
          onClose={() => setDetailPlayer(null)}
        />
      )}
    </motion.div>
  );
}
