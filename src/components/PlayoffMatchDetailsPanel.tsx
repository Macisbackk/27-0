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
    <div className="divide-y divide-white/10">
      <div className="pb-2.5">
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
      </div>
      <div className="pt-2.5">
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
        <div className="relative flex items-center justify-center pr-14">
          <p className={`min-w-0 text-center ${TYPO.keyLabel}`}>
            {getPlayoffRoundLabel(match.round)}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`absolute right-0 top-1/2 -translate-y-1/2 ${BTN.closeSm}`}
          >
            Close
          </button>
        </div>

        {scoringBlock}

        {motm ? (
          <p className={`text-center ${TYPO.bodySm}`}>
            <span className="text-pitch-500">POTM </span>
            <span className="font-semibold text-accent-gold">{motm.playerName}</span>
            {motm.performanceSummary ? (
              <span className="text-pitch-400"> · {motm.performanceSummary}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
