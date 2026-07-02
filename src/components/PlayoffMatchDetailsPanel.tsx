"use client";

import { motion } from "framer-motion";
import type { PlayoffBracketMatch } from "@/lib/game/playoff-bracket";
import { getPlayoffRoundLabel } from "@/lib/game/playoff-bracket";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
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
    ? null
    : match.userFixture?.isHome
      ? "Home"
      : match.isUserMatch
        ? "Away"
        : "Home";

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
              {getPlayoffRoundLabel(match.round)} · Match Details
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {venueLabel ? `${venueLabel} · ` : ""}
              {match.homeTeam} vs {match.awayTeam}
            </p>
            {match.userFixture?.matchBio && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Match Story</p>
                <p className={`mt-2 ${TYPO.bodySm}`}>
                  {match.userFixture.matchBio}
                </p>
              </div>
            )}
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

        {scoring ? (
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
        )}
      </div>
    </motion.div>
  );
}
