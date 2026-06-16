"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClubBreakdownSummary } from "@/lib/squad-analysis";
import { getClubColors } from "@/lib/clubs";
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
                      {c.count} player{c.count === 1 ? "" : "s"} · squad value{" "}
                      included in team total
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
