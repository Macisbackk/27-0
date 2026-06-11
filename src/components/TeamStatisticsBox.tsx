"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getTeamTier } from "@/lib/team-tiers";
import { formatValue } from "@/lib/players";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { StatBox } from "./ui/StatBox";
import { SquadSummaryPanel } from "./SquadSummaryPanel";

interface TeamStatisticsBoxProps {
  squad: SquadSlot[];
  totalValue: number;
  userTeamName?: string;
  delay?: number;
}

export const TeamStatisticsBox = memo(function TeamStatisticsBox({
  squad,
  totalValue,
  userTeamName = "Dream Team",
  delay = 0,
}: TeamStatisticsBoxProps) {
  const avgRating = getAverageSquadRating(squad);
  const tier = getTeamTier(avgRating);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className={`grid ${SPACING.cardGridGap} sm:grid-cols-3`}>
        <StatBox label="Average Rating" value={avgRating.toFixed(1)} size="sm" />
        <StatBox label="Team Tier" value={tier} size="sm" light />
        <StatBox
          label="Squad Value"
          value={formatValue(totalValue)}
          size="sm"
          highlight
        />
      </div>

      <div>
        <p className={`${TYPO.statLabel} mb-3`}>{userTeamName} Players</p>
        <SquadSummaryPanel squad={squad} />
      </div>
    </motion.div>
  );
});
