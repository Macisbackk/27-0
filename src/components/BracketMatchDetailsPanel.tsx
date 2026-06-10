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
            <TeamScoringBlock teamName={match.homeTeam} scoring={scoring.home} />
            <TeamScoringBlock teamName={match.awayTeam} scoring={scoring.away} />
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
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackSm}>
      <ClubTeamLabel club={teamName} />
      {hasTries && (
        <ScoringSection title="Tries">
          <ul className={SPACING.stackSm}>
            {scoring.tryScorers.map((s) => (
              <li
                key={s.playerId}
                className={`${CARD.inset} flex items-center justify-between gap-2 px-2.5 py-2`}
              >
                <span className={TYPO.statValue}>{s.name}</span>
                <span className={`shrink-0 ${TYPO.rating} text-sm`}>
                  {s.tries} {s.tries === 1 ? "try" : "tries"}
                </span>
              </li>
            ))}
          </ul>
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
        <p className={TYPO.bodySm}>No scoring breakdown recorded.</p>
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
