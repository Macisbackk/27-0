"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClubLogoBox } from "@/components/ClubBadge";
import type { Player, SquadSlot } from "@/lib/types";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getPlayerRatingForPosition } from "@/lib/players/player-positions";
import { getAgeAtYear, getPlayerAge } from "@/lib/players/player-age";
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
  /** Hide Current/Era “season’s form” rating note (e.g. Daily Challenge). */
  hideRatingNote?: boolean;
  /** The position being filled and the squad so far — for the header and team-rating preview. */
  slot?: SquadSlot | null;
  squad?: SquadSlot[];
}

function ageFor(player: Player, year: string): number | undefined {
  if (player.category === "current") return getPlayerAge(player);
  const y = Number.parseInt(year, 10);
  return Number.isFinite(y) ? getAgeAtYear(player, y) : undefined;
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
  hideRatingNote = false,
  slot = null,
  squad,
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

  const slotRatingOf = (player: Player) =>
    slot ? getPlayerRatingForPosition(player, slot.position) : player.peakRating;

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          (slot ? getPlayerRatingForPosition(b.player, slot.position) : b.player.peakRating) -
          (slot ? getPlayerRatingForPosition(a.player, slot.position) : a.player.peakRating)
      ),
    [entries, slot]
  );
  const topRating = sortedEntries[0] ? slotRatingOf(sortedEntries[0].player) : 0;

  // Team rating if you sign each player (only once someone is already in the side).
  const impactFor = useMemo(() => {
    if (!slot || !squad || hardMode) return () => null;
    const filled = squad.filter((s) => s.player).length;
    if (filled === 0) return () => null;
    const before = getAverageSquadRating(squad);
    return (player: Player) => {
      const after = getAverageSquadRating(
        squad.map((s) => (s.slotIndex === slot.slotIndex ? { ...s, player } : s))
      );
      return { after, delta: Math.round((after - before) * 10) / 10 };
    };
  }, [slot, squad, hardMode]);
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
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={onBack}
                disabled={disabled}
                className={`${LINK.subtle} disabled:opacity-40`}
              >
                ← Back to team sheet
              </button>
            </div>
          )}

          <div className="flex flex-col items-center text-center">
            <ClubLogoBox
              club={target.team}
              size="md"
              showAbbrev={false}
              className="hidden sm:flex"
            />
            <ClubLogoBox
              club={target.team}
              size="sm"
              showAbbrev={false}
              className="sm:hidden"
            />
            <div className="mt-2 min-w-0 w-full">
              <p className={TYPO.sectionLabel}>
                {slot ? `Pick your ${slot.label}` : "Pick your signing"}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold leading-tight text-white sm:text-2xl">
                {target.team}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
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
              {hideRatingNote ? null : eraMode ? (
                <EraRatingExplanation compact className="mb-1.5 px-1" />
              ) : (
                <CurrentRatingExplanation compact className="mb-1.5 px-1" />
              )}
              <div className={quickPlayerChoiceGridClass(choiceCount)}>
                {sortedEntries.map(({ player }, index) => {
                  const slotRating = slotRatingOf(player);
                  const isTopPick =
                    !hardMode &&
                    slotRating === topRating &&
                    sortedEntries.length > 1;
                  const age = ageFor(player, target.year);

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
                        slotRating={slotRating}
                        impact={impactFor(player)}
                        ageLabel={age !== undefined ? `Age ${age}` : undefined}
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
