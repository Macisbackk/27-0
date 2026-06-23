"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import type { TeamScoringDetail } from "@/lib/game/season-simulation";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubNameLabel } from "./ClubNameLabel";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { TryScorerChips, TryScorersEmptyNote } from "./TryScorerChips";

interface BracketMatchDetailsPanelProps {
  match: BracketMatch;
  eraClubLookup?: Record<string, string>;
  onClose: () => void;
}

export function BracketMatchDetailsPanel({
  match,
  eraClubLookup,
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
      <div className={`${SPACING.cardPadding} ${SPACING.stackLg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 flex-1 ${SPACING.stackSm}`}>
            <p className={TYPO.sectionLabel}>
              {getCupRoundLabel(match.round)} · Match Details
            </p>
            <div
              className={`${CARD.stat} ${SPACING.cardPaddingSm} flex flex-wrap items-center justify-center gap-2 sm:justify-start`}
            >
              <ClubNameLabel club={match.homeTeam} variant="inline" />
              <span
                className={`${TYPO.cardTitle} whitespace-nowrap ${
                  homeWon ? "text-accent-green" : "text-gray-200"
                }`}
              >
                {match.homeScore} – {match.awayScore}
              </span>
              <ClubNameLabel club={match.awayTeam} variant="inline" />
            </div>
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoring ? (
          <div className={SPACING.stackLg}>
            <TeamScoringBlock
              teamName={match.homeTeam}
              colorClub={resolveEraTeamClubName(match.homeTeam, eraClubLookup)}
              scoring={scoring.home}
              variant="user"
            />
            <TeamScoringBlock
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

function TeamScoringBlock({
  teamName,
  colorClub,
  scoring,
  variant,
}: {
  teamName: string;
  colorClub: string;
  scoring: TeamScoringDetail;
  variant: "user" | "opponent";
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackMd}>
      <ClubTeamLabel club={teamName} colorClub={colorClub} />
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
          <p className={`${TYPO.statValue} break-words`}>
            {kicking.name} ({kicking.conversions}/{kicking.conversionAttempts})
          </p>
        </ScoringSection>
      )}
      {hasPenalties && kicking && (
        <ScoringSection title="Penalties">
          <p className={`${TYPO.statValue} break-words`}>
            {kicking.name} ({kicking.penalties})
          </p>
        </ScoringSection>
      )}
      {hasDropGoals && kicking && (
        <ScoringSection title="Drop Goals">
          <p className={`${TYPO.statValue} break-words`}>
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
