"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import type { TeamValueEntry } from "@/lib/team-value-comparison";
import { formatValue } from "@/lib/players";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getTeamTier } from "@/lib/team-tiers";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { StatBox } from "./ui/StatBox";
import { ClubNameLabel } from "./ClubNameLabel";
import { SquadSummaryPanel } from "./SquadSummaryPanel";

interface TeamStatisticsBoxProps {
  squad: SquadSlot[];
  totalValue: number;
  mostExpensiveTeam: TeamValueEntry;
  userTeamName?: string;
  delay?: number;
}

export const TeamStatisticsBox = memo(function TeamStatisticsBox({
  squad,
  totalValue,
  mostExpensiveTeam,
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

      <div className={`${CARD.inset} px-4 py-3`}>
        <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-gold">
          Most Expensive Team
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ClubNameLabel
            club={mostExpensiveTeam.name}
            variant="pill"
            className="max-w-full truncate"
          />
          <span className="font-display text-base font-black text-accent-gold sm:text-lg">
            {formatValue(mostExpensiveTeam.value)}
          </span>
        </div>
      </div>

      <div>
        <p className={`${TYPO.statLabel} mb-3`}>{userTeamName} Players</p>
        <SquadSummaryPanel squad={squad} />
      </div>
    </motion.div>
  );
});
