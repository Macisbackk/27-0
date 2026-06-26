"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerTryTotal } from "@/lib/game/season-tries";
import { buildPlayerSeasonReviewStats } from "@/lib/player-season-review";
import type { SeasonAward } from "@/lib/season-awards";
import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { getFormationSlotDisplayLabel } from "@/lib/positions";
import { formatPlayerPositionLabel } from "@/lib/players/player-positions";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { BodyPortal } from "./ui/BodyPortal";

interface TeamSheetPlayerPopupProps {
  slot: SquadSlot | null;
  hardMode?: boolean;
  clubColorOverride?: string;
  tryScorers?: PlayerTryTotal[];
  awards?: SeasonAward[];
  totalMatches?: number;
  statsScope?: "season" | "playoff";
  onClose: () => void;
}

export function TeamSheetPlayerPopup({
  slot,
  hardMode = false,
  clubColorOverride,
  tryScorers,
  awards,
  totalMatches,
  statsScope = "season",
  onClose,
}: TeamSheetPlayerPopupProps) {
  const player = slot?.player ?? null;

  useEffect(() => {
    if (!player) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, onClose]);

  useEffect(() => {
    if (!player) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [player]);

  const club = player ? getPlayerColorClub(player, clubColorOverride) : "";
  const colors = club ? getClubColors(club) : null;
  const seasonStats =
    slot && player
      ? buildPlayerSeasonReviewStats(slot, {
          tryScorers,
          awards,
          totalMatches,
          hardMode,
          statsScope,
        })
      : null;

  return (
    <BodyPortal>
      <AnimatePresence>
        {player && slot && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${player.name} details`}
              className={`${CARD.panel} max-h-[min(85dvh,640px)] w-full max-w-sm overflow-y-auto overscroll-contain p-0 shadow-2xl`}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              {colors && (
                <div className="flex h-1.5 w-full">
                  <span
                    className="h-full flex-1"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <span
                    className="h-full flex-1"
                    style={{ backgroundColor: colors.secondary }}
                  />
                </div>
              )}

              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {club && <ClubDualSwatch club={club} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <h3 className={`${TYPO.cardTitle} break-words text-white`}>
                      {player.name}
                    </h3>
                    <p className={`mt-1 ${TYPO.bodySm} text-gray-400`}>
                      {formatPlayerPositionLabel(player, { short: false })} ·{" "}
                      {getFormationSlotDisplayLabel(slot.slotIndex)}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  {club && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-gray-500">Club</dt>
                      <dd className="min-w-0 text-right font-medium text-gray-200 break-words">
                        {club}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-gray-500">Played as</dt>
                    <dd className="min-w-0 text-right font-medium text-gray-200 break-words">
                      {getFormationSlotDisplayLabel(slot.slotIndex)}
                    </dd>
                  </div>
                  {!hardMode && seasonStats?.rating !== undefined && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Rating</dt>
                      <dd className="font-semibold text-accent-green">
                        {seasonStats.rating}
                      </dd>
                    </div>
                  )}
                  {!hardMode && seasonStats?.valueLabel && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Value</dt>
                      <dd className="font-semibold text-accent-gold">
                        {seasonStats.valueLabel}
                      </dd>
                    </div>
                  )}
                  {seasonStats?.matchesPlayed !== undefined && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Matches</dt>
                      <dd className="font-medium text-gray-200">
                        {seasonStats.matchesPlayed}
                      </dd>
                    </div>
                  )}
                  {seasonStats?.tries !== undefined && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">
                        {statsScope === "playoff" ? "Play-off tries" : "Season tries"}
                      </dt>
                      <dd className="font-semibold text-accent-gold">
                        {seasonStats.tries}
                      </dd>
                    </div>
                  )}
                  {seasonStats?.awardWon && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-gray-500">Award</dt>
                      <dd className="min-w-0 text-right font-medium text-accent-green break-words">
                        {seasonStats.awardWon}
                      </dd>
                    </div>
                  )}
                </dl>

                {seasonStats?.contributionSummary && (
                  <p className="mt-4 rounded-lg border border-pitch-700/40 bg-pitch-950/50 px-3 py-2 text-sm leading-relaxed text-gray-400">
                    {seasonStats.contributionSummary}
                  </p>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-5 w-full min-h-[44px] rounded-lg border border-pitch-600/60 bg-pitch-900/60 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:border-pitch-500/60 hover:bg-pitch-800/60"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BodyPortal>
  );
}
