"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import type { TeamScoringDetail } from "@/lib/game/season-simulation";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { KickingSummarySection } from "./KickingSummarySection";
import { TeamColouredScoringSection } from "./TeamColouredScoringSection";
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
  const hasKicking =
    (kicking?.conversions ?? 0) > 0 ||
    (kicking?.penalties ?? 0) > 0 ||
    (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackMd}>
      <ClubTeamLabel club={teamName} colorClub={colorClub} />
      {hasTries && (
        <TeamColouredScoringSection colorClub={colorClub}>
          <p className={TYPO.sectionTitle}>Tries</p>
          <div className="mt-2">
            <TryScorerChips
              scorers={scoring.tryScorers.map((s) => ({
                playerId: s.playerId,
                name: s.name,
                tries: s.tries,
              }))}
              variant={variant}
            />
          </div>
        </TeamColouredScoringSection>
      )}
      {hasKicking && (
        <TeamColouredScoringSection colorClub={colorClub}>
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
