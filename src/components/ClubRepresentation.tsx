"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClubBreakdownSummary } from "@/lib/squad-analysis";
import { getClubColors } from "@/lib/clubs";
import { POSITION_SHORT } from "@/lib/positions";
import { RLClubRow } from "./cards/RLClubRow";
import { playPanelExpand } from "@/lib/sound";
import { SPACING } from "@/lib/ui/design-system";
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
                      className="mt-2 rounded-lg border border-pitch-600/50 px-3 py-2 text-sm text-gray-400"
                      style={{
                        borderLeftColor: colors.primary,
                        borderLeftWidth: 3,
                      }}
                    >
                      <p className="mb-2 text-xs text-gray-500">
                        {c.count} player{c.count === 1 ? "" : "s"} · squad value included in team total
                      </p>
                      <div className="space-y-1.5">
                        {c.players.map((player) => (
                          <div
                            key={`${c.club}-${player.playerId}-${player.slotIndex}`}
                            className="flex items-center justify-between gap-2 rounded-md border border-pitch-700/50 bg-pitch-950/40 px-2 py-1.5"
                          >
                            <p className="min-w-0 flex-1 truncate text-xs text-gray-300">
                              {player.name}
                            </p>
                            <p className="shrink-0 text-[11px] font-semibold text-gray-400">
                              {POSITION_SHORT[player.naturalPosition]} · {player.adjustedRating}
                            </p>
                          </div>
                        ))}
                      </div>
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
