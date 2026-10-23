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
import { BTN, CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  acquireScrollLock,
  releaseScrollLock,
  type ScrollLockId,
} from "@/lib/ui/scroll-lock";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { useModalA11y } from "@/hooks/useModalA11y";
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

  // Escape, focus in/out and Tab trapping (this popup keeps its own scroll lock below).
  const panelRef = useModalA11y(Boolean(player), onClose, { lockScroll: false });

  useEffect(() => {
    if (!player) return;
    const lockId: ScrollLockId = acquireScrollLock("team-sheet-player");
    return () => {
      releaseScrollLock(lockId);
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
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            exit={{ y: 8 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          >
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={`${player.name} details`}
              className={`${CARD.panel} max-h-[min(85dvh,640px)] w-full max-w-sm overflow-y-auto overscroll-contain p-0 shadow-2xl`}
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 14 }}
              transition={{ duration: 0.16 }}
              onClick={(event) => event.stopPropagation()}
            >
              {colors && (
                <div className="flex h-0.5 w-full">
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
                    <h3 className={`${TYPO.cardHeading} break-words`}>
                      {player.name}
                    </h3>
                    <p className={`mt-1 ${TYPO.label}`}>
                      {formatPlayerPositionLabel(player, { short: false })} ·{" "}
                      {getFormationSlotDisplayLabel(slot.slotIndex)}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  {club && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-[color:var(--fl-muted)]">Club</dt>
                      <dd className="min-w-0 text-right font-medium text-gray-200 break-words">
                        {club}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-[color:var(--fl-muted)]">Played as</dt>
                    <dd className="min-w-0 text-right font-medium text-gray-200 break-words">
                      {getFormationSlotDisplayLabel(slot.slotIndex)}
                    </dd>
                  </div>
                  {!hardMode && seasonStats?.rating !== undefined && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[color:var(--fl-muted)]">Rating</dt>
                      <dd className="font-semibold text-[color:var(--rating)]">
                        {seasonStats.rating}
                      </dd>
                    </div>
                  )}
                  {!hardMode && seasonStats?.valueLabel && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[color:var(--fl-muted)]">Value</dt>
                      <dd className="font-semibold text-accent-gold">
                        {seasonStats.valueLabel}
                      </dd>
                    </div>
                  )}
                  {seasonStats?.matchesPlayed !== undefined && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[color:var(--fl-muted)]">Matches</dt>
                      <dd className="font-medium text-gray-200">
                        {seasonStats.matchesPlayed}
                      </dd>
                    </div>
                  )}
                  {seasonStats?.tries !== undefined && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[color:var(--fl-muted)]">
                        {statsScope === "playoff" ? "Play-off tries" : "Season tries"}
                      </dt>
                      <dd className="font-semibold text-accent-gold">
                        {seasonStats.tries}
                      </dd>
                    </div>
                  )}
                  {seasonStats?.awardWon && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-[color:var(--fl-muted)]">Award</dt>
                      <dd className="min-w-0 text-right font-medium text-accent-gold break-words">
                        {seasonStats.awardWon}
                      </dd>
                    </div>
                  )}
                </dl>

                {seasonStats?.contributionSummary && (
                  <p className="mt-4 rounded-control bg-pitch-950 px-3 py-2.5 text-sm leading-relaxed text-[color:var(--fl-muted)]">
                    {seasonStats.contributionSummary}
                  </p>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className={`mt-5 w-full ${BTN.secondary}`}
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
