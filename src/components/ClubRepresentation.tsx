"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClubBreakdownSummary } from "@/lib/squad-analysis";
import { getFormationSlotSortOrder } from "@/lib/positions";
import { getClubColors } from "@/lib/clubs";
import { POSITION_SHORT } from "@/lib/positions";
import { RLClubRow } from "./cards/RLClubRow";
import { playPanelExpand } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface ClubRepresentationProps {
  summary: ClubBreakdownSummary;
  /** Era mode: apply era team colours to all club rows. */
  clubColorOverride?: string;
}

export function ClubRepresentation({
  summary,
  clubColorOverride,
}: ClubRepresentationProps) {
  const { clubs } = summary;
  const [expandedClub, setExpandedClub] = useState<string | null>(
    clubs.length === 1 ? clubs[0]!.club : null
  );

  const toggleClub = (club: string) => {
    setExpandedClub((prev) => {
      if (prev !== club) playPanelExpand();
      return prev === club ? null : club;
    });
  };

  return (
    <div className={SPACING.stackMd}>
      {clubs.length === 0 ? (
        <p className={TYPO.bodySm}>No players signed</p>
      ) : (
        clubs.map((c) => {
          const isExpanded = expandedClub === c.club;
          const colors = getClubColors(clubColorOverride ?? c.club);
          const players = [...c.players].sort(
            (a, b) =>
              getFormationSlotSortOrder(a.slotIndex) -
              getFormationSlotSortOrder(b.slotIndex)
          );

          return (
            <div key={c.club}>
              <RLClubRow
                club={c.club}
                count={c.count}
                totalValue={c.totalValue}
                expanded={isExpanded}
                onClick={() => toggleClub(c.club)}
              />
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`${CARD.inset} mt-2 overflow-hidden`}
                      style={{
                        borderLeftColor: colors.primary,
                        borderLeftWidth: 3,
                      }}
                    >
                      <p className={`border-b border-pitch-700/40 px-2.5 py-1.5 ${TYPO.bodySm} text-gray-500`}>
                        {c.count} player{c.count === 1 ? "" : "s"}
                      </p>
                      <ul className="divide-y divide-pitch-700/35">
                        {players.map((player) => (
                          <li
                            key={`${c.club}-${player.playerId}-${player.slotIndex}`}
                            className="flex min-w-0 items-center gap-2 px-2.5 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate font-display text-xs font-semibold text-white sm:text-sm">
                              {player.name}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 sm:text-[11px]">
                              {POSITION_SHORT[player.naturalPosition]}
                            </span>
                            <span className="shrink-0 font-display text-xs font-bold text-accent-green sm:text-sm">
                              {player.adjustedRating}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </div>
  );
}
