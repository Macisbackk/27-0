"use client";

import { motion } from "framer-motion";
import type { PlayoffBracketMatch } from "@/lib/game/playoff-bracket";
import { getPlayoffRoundLabel } from "@/lib/game/playoff-bracket";
import { GRAND_FINAL_VENUE } from "@/lib/manager/managerPlayoffs";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { CollapsibleDetails } from "@/components/ui/MobileLayout";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";

interface PlayoffMatchDetailsPanelProps {
  match: PlayoffBracketMatch;
  onClose: () => void;
  className?: string;
}

export function PlayoffMatchDetailsPanel({
  match,
  onClose,
  className = "",
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
  const venueLabel = match.isNeutral
    ? GRAND_FINAL_VENUE
    : match.userFixture?.isHome
      ? "Home"
      : match.isUserMatch
        ? "Away"
        : "Home";

  const scoreboard = (
    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 uppercase tracking-wide leading-tight text-white">
      <span
        className="min-w-0 truncate text-right font-[family-name:var(--font-pitch)] text-[length:var(--text-body)] sm:text-[length:var(--text-section-header)]"
        title={match.homeTeam}
      >
        {match.homeTeam}
      </span>
      <span className="shrink-0 text-center font-display text-2xl font-black tabular-nums text-theme-primary sm:text-3xl">
        {match.homeScore}-{match.awayScore}
      </span>
      <span
        className="min-w-0 truncate text-left font-[family-name:var(--font-pitch)] text-[length:var(--text-body)] sm:text-[length:var(--text-section-header)]"
        title={match.awayTeam}
      >
        {match.awayTeam}
      </span>
    </div>
  );

  const scoringBlock = scoring ? (
    <div className="space-y-4">
      <TeamScoringBreakdown
        teamName={match.homeTeam}
        colorClub={match.homeTeam}
        scoring={scoring.home}
      />
      <TeamScoringBreakdown
        teamName={match.awayTeam}
        colorClub={match.awayTeam}
        scoring={scoring.away}
        variant="opponent"
      />
    </div>
  ) : (
    <p className={TYPO.body}>Scoring data unavailable.</p>
  );

  return (
    <motion.div
      className={`match-details-expand mt-4 ${CARD.base} border-theme-primary/30 shadow-lg ${className}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className={`${SPACING.cardPadding} ${SPACING.stackLg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 flex-1 ${SPACING.stackMd}`}>
            <p className={TYPO.sectionLabel}>
              {getPlayoffRoundLabel(match.round)}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {venueLabel ? `${venueLabel}` : ""}
            </p>
            {scoreboard}
            {match.userFixture?.manOfTheMatch && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Player of the Match</p>
                <p className={`mt-2 break-words ${TYPO.bodySm}`}>
                  {match.userFixture.manOfTheMatch.playerName}
                  {match.userFixture.manOfTheMatch.performanceSummary && (
                    <span className="text-gray-500">
                      {" "}
                      · {match.userFixture.manOfTheMatch.performanceSummary}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        <div className="sm:hidden">
          <CollapsibleDetails summary="Match Stats">
            {scoringBlock}
          </CollapsibleDetails>
        </div>
        <div className="hidden sm:block">{scoringBlock}</div>
      </div>
    </motion.div>
  );
}
