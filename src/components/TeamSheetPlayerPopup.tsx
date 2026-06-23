"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import { getClubColors } from "@/lib/clubs";
import { getPlayerColorClub } from "@/lib/players/run-club";
import { POSITION_LABELS } from "@/lib/positions";
import { getEffectivePeakRating } from "@/lib/squad-analysis";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface TeamSheetPlayerPopupProps {
  slot: SquadSlot | null;
  hardMode?: boolean;
  clubColorOverride?: string;
  onClose: () => void;
}

export function TeamSheetPlayerPopup({
  slot,
  hardMode = false,
  clubColorOverride,
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

  const club = player ? getPlayerColorClub(player, clubColorOverride) : "";
  const colors = club ? getClubColors(club) : null;
  const rating = player && slot ? getEffectivePeakRating(slot) : null;

  return (
    <AnimatePresence>
      {player && slot && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${player.name} details`}
            className={`${CARD.panel} w-full max-w-sm overflow-hidden p-0`}
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
                    {POSITION_LABELS[slot.position]}
                  </p>
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                {club && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Club</dt>
                    <dd className="text-right font-medium text-gray-200">
                      {club}
                    </dd>
                  </div>
                )}
                {!hardMode && rating !== null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Rating</dt>
                    <dd className="font-semibold text-accent-green">
                      {Math.round(rating)}
                    </dd>
                  </div>
                )}
              </dl>

              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-lg border border-pitch-600/60 bg-pitch-900/60 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:border-pitch-500/60 hover:bg-pitch-800/60"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
