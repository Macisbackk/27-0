"use client";

import { motion } from "framer-motion";
import type { PlayoffBracketMatch } from "@/lib/game/playoff-bracket";
import { getPlayoffRoundLabel } from "@/lib/game/playoff-bracket";
import { CARD, BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";

interface PlayoffMatchDetailsPanelProps {
  match: PlayoffBracketMatch;
  onClose: () => void;
  className?: string;
  /** Quick Mode — Dream Team panels use squad majority club colours. */
  userClubColorOverride?: string;
}

export function PlayoffMatchDetailsPanel({
  match,
  onClose,
  className = "",
  userClubColorOverride,
}: PlayoffMatchDetailsPanelProps) {
  if (
    !match.homeTeam ||
    !match.awayTeam ||
    match.homeScore === null ||
    match.awayScore === null
  ) {
    return null;
  }

  const scoring = match.scoringDetail;
  const motm = match.userFixture?.manOfTheMatch;

  const scoringBlock = scoring ? (
    <div className="space-y-2.5">
      <TeamScoringBreakdown
        teamName={match.homeTeam}
        colorClub={
          match.homeTeam === DREAM_TEAM_NAME && userClubColorOverride
            ? userClubColorOverride
            : match.homeTeam
        }
        scoring={scoring.home}
        flat
      />
      <TeamScoringBreakdown
        teamName={match.awayTeam}
        colorClub={
          match.awayTeam === DREAM_TEAM_NAME && userClubColorOverride
            ? userClubColorOverride
            : match.awayTeam
        }
        scoring={scoring.away}
        variant="opponent"
        flat
      />
    </div>
  ) : (
    <p className={`text-center ${TYPO.bodySm}`}>Scoring data unavailable.</p>
  );

  return (
    <motion.div
      className={`match-details-expand mt-3 ${CARD.base} border-white/10 ${className}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="space-y-2.5 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <p className={`min-w-0 flex-1 text-center ${TYPO.keyLabel}`}>
            {getPlayoffRoundLabel(match.round)}
          </p>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoringBlock}

        {motm ? (
          <p className={`text-center ${TYPO.bodySm}`}>
            <span className="text-pitch-500">POTM </span>
            <span className="font-semibold text-white">{motm.playerName}</span>
            {motm.performanceSummary ? (
              <span className="text-pitch-400"> · {motm.performanceSummary}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
