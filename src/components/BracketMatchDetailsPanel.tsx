"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import type { TeamScoringDetail } from "@/lib/game/season-simulation";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubNameLabel } from "./ClubNameLabel";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { TryScorerChips, TryScorersEmptyNote } from "./TryScorerChips";

interface BracketMatchDetailsPanelProps {
  match: BracketMatch;
  onClose: () => void;
}

export function BracketMatchDetailsPanel({
  match,
  onClose,
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
  const homeWon = match.homeScore > match.awayScore;

  return (
    <motion.div
      className={`match-details-expand mt-4 overflow-hidden ${CARD.base} border-accent-green/30 shadow-lg`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className={SPACING.cardPadding}>
        <div className={`${SPACING.headingMargin} flex items-start justify-between gap-2`}>
          <div className="min-w-0">
            <p className={TYPO.sectionLabel}>
              {getCupRoundLabel(match.round)} · Match Details
            </p>
            <div className={`mt-2 flex flex-wrap items-center justify-center ${SPACING.buttonGap} sm:justify-start`}>
              <ClubNameLabel club={match.homeTeam} variant="inline" />
              <span className={`${TYPO.cardTitle} whitespace-nowrap`}>
                {match.homeScore} – {match.awayScore}
              </span>
              <ClubNameLabel club={match.awayTeam} variant="inline" />
            </div>
            <p
              className={`mt-1 font-display text-sm font-bold ${
                homeWon ? "text-accent-green" : "text-red-400"
              }`}
            >
              Winner: {match.winner ?? (homeWon ? match.homeTeam : match.awayTeam)}
            </p>
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
              variant="user"
            />
            <TeamScoringBlock
              teamName={match.awayTeam}
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

function TeamScoringBlock({
  teamName,
  scoring,
  variant,
}: {
  teamName: string;
  scoring: TeamScoringDetail;
  variant: "user" | "opponent";
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackSm}>
      <ClubTeamLabel club={teamName} />
      {hasTries && (
        <ScoringSection title="Tries">
          <TryScorerChips
            scorers={scoring.tryScorers.map((s) => ({
              playerId: s.playerId,
              name: s.name,
              tries: s.tries,
            }))}
            variant={variant}
          />
        </ScoringSection>
      )}
      {hasConversions && kicking && (
        <ScoringSection title="Conversions">
          <p className={TYPO.statValue}>
            {kicking.name} ({kicking.conversions}/{kicking.conversionAttempts})
          </p>
        </ScoringSection>
      )}
      {hasPenalties && kicking && (
        <ScoringSection title="Penalties">
          <p className={TYPO.statValue}>
            {kicking.name} ({kicking.penalties})
          </p>
        </ScoringSection>
      )}
      {hasDropGoals && kicking && (
        <ScoringSection title="Drop Goals">
          <p className={TYPO.statValue}>
            {kicking.name} ({kicking.dropGoals})
          </p>
        </ScoringSection>
      )}
      {!hasTries && !hasConversions && !hasPenalties && !hasDropGoals && (
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
