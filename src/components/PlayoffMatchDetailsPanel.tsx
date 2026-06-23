"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { PlayoffBracketMatch } from "@/lib/game/playoff-bracket";
import { getPlayoffRoundLabel } from "@/lib/game/playoff-bracket";
import type { TeamScoringDetail } from "@/lib/game/season-simulation";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { KickingSummarySection } from "./KickingSummarySection";
import { TeamColouredScoringSection } from "./TeamColouredScoringSection";
import { TryScorerChips, TryScorersEmptyNote } from "./TryScorerChips";

interface PlayoffMatchDetailsPanelProps {
  match: PlayoffBracketMatch;
  onClose: () => void;
}

export function PlayoffMatchDetailsPanel({
  match,
  onClose,
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
    ? "Neutral"
    : match.userFixture?.isHome
      ? "Home"
      : match.isUserMatch
        ? "Away"
        : "Home";

  return (
    <motion.div
      className={`match-details-expand mt-4 overflow-hidden ${CARD.base} border-accent-green/30 shadow-lg`}
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
              {venueLabel} · {match.homeTeam} vs {match.awayTeam}
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
          <div className={SPACING.stackLg}>
            <TeamScoringBlock
              teamName={match.homeTeam}
              scoring={scoring.home}
            />
            <TeamScoringBlock
              teamName={match.awayTeam}
              scoring={scoring.away}
            />
          </div>
        ) : (
          <p className={TYPO.body}>Scoring data unavailable.</p>
        )}
      </div>
    </motion.div>
  );
}

function TeamScoringBlock({
  teamName,
  scoring,
}: {
  teamName: string;
  scoring: TeamScoringDetail;
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasKicking =
    (kicking?.conversions ?? 0) > 0 ||
    (kicking?.penalties ?? 0) > 0 ||
    (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackMd}>
      <ClubTeamLabel club={teamName} colorClub={teamName} />
      {hasTries && (
        <TeamColouredScoringSection colorClub={teamName}>
          <p className={TYPO.sectionTitle}>Tries</p>
          <div className="mt-2">
            <TryScorerChips
              scorers={scoring.tryScorers.map((s) => ({
                playerId: s.playerId,
                name: s.name,
                tries: s.tries,
              }))}
            />
          </div>
        </TeamColouredScoringSection>
      )}
      {hasKicking && (
        <TeamColouredScoringSection colorClub={teamName}>
          <KickingSummarySection kicking={kicking} bare />
        </TeamColouredScoringSection>
      )}
      {!hasTries && !hasKicking && (
        <TryScorersEmptyNote />
      )}
    </div>
  );
}

function ScoringSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
      <p className={TYPO.sectionTitle}>{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
