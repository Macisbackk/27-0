"use client";

import { motion } from "framer-motion";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";

interface BracketMatchDetailsPanelProps {
  match: BracketMatch;
  eraClubLookup?: Record<string, string>;
  onClose: () => void;
  className?: string;
}

export function BracketMatchDetailsPanel({
  match,
  eraClubLookup,
  onClose,
  className = "",
}: BracketMatchDetailsPanelProps) {
  if (
    !match.homeTeam ||
    !match.awayTeam ||
    match.homeScore === null ||
    match.awayScore === null
  ) {
    return null;
  }

  const scoring = match.scoringDetail;

  return (
    <motion.div
      className={`match-details-expand mt-4 overflow-hidden ${CARD.base} border-accent-green/30 shadow-lg ${className}`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className={`${SPACING.cardPadding} ${SPACING.stackLg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 flex-1 ${SPACING.stackMd}`}>
            <p className={TYPO.sectionLabel}>
              {getCupRoundLabel(match.round)} · Match Details
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {match.homeTeam} vs {match.awayTeam}
            </p>
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoring ? (
          <div className="space-y-4">
            <TeamScoringBreakdown
              teamName={match.homeTeam}
              colorClub={resolveEraTeamClubName(match.homeTeam, eraClubLookup)}
              scoring={scoring.home}
              variant="user"
            />
            <TeamScoringBreakdown
              teamName={match.awayTeam}
              colorClub={resolveEraTeamClubName(match.awayTeam, eraClubLookup)}
              scoring={scoring.away}
              variant="opponent"
            />
          </div>
        ) : (
          <p className={TYPO.body}>Scoring data unavailable.</p>
        )}
      </div>
    </motion.div>
  );
}
