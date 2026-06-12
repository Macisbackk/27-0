"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import {
  DREAM_TEAM_NAME,
  formatFixtureScore,
  type TeamScoringDetail,
} from "@/lib/game/season-simulation";
import { getOpponentTeamSummary } from "@/lib/game/opponent-scorers";
import { formatValue } from "@/lib/players";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { getTeamTier } from "@/lib/team-tiers";
import {
  findSlotByPlayerId,
  formatPlayerLineExtras,
} from "@/lib/squad-display";
import { getSquadValue } from "@/lib/positions";
import type { SquadSlot } from "@/lib/types";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { StatBox } from "./ui/StatBox";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { TryScorerChips, TryScorersEmptyNote } from "./TryScorerChips";

interface MatchDetailsPanelProps {
  fixture: MatchFixture;
  onClose: () => void;
  roundLabel?: string;
  seed: string;
  userSquad?: SquadSlot[];
  /** User's team name — defaults to Dream Team for season mode. */
  userTeamName?: string;
}

export function MatchDetailsPanel({
  fixture,
  onClose,
  roundLabel,
  seed,
  userSquad,
  userTeamName = DREAM_TEAM_NAME,
}: MatchDetailsPanelProps) {
  const detail = fixture.scoringDetail;
  const userValue = userSquad ? getSquadValue(userSquad) : 0;
  const userAvgRating = userSquad ? getAverageSquadRating(userSquad) : 0;
  const userTier = getTeamTier(userAvgRating);
  const opponentSummary = getOpponentTeamSummary(
    fixture.opponent,
    seed,
    fixture.round
  );

  return (
    <motion.div
      className={`match-details-expand overflow-hidden ${CARD.base} border-accent-green/30 shadow-lg`}
      initial={{ height: 0, opacity: 0, marginTop: 0 }}
      animate={{ height: "auto", opacity: 1, marginTop: 4 }}
      exit={{ height: 0, opacity: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className={SPACING.cardPadding}>
        <div className={`${SPACING.headingMargin} flex items-start justify-between gap-2`}>
          <div className="min-w-0">
            <p className={TYPO.sectionLabel}>
              {roundLabel ?? `Round ${fixture.round}`} · Match Details
            </p>
            <p className={`mt-1 ${TYPO.cardTitle}`}>
              {formatFixtureScore(fixture)}
            </p>
            <p
              className={`mt-1 font-display text-sm font-bold ${
                fixture.result === "W" ? "text-accent-green" : "text-red-400"
              }`}
            >
              {fixture.result === "W" ? "Victory" : "Defeat"}
            </p>
            {fixture.matchBio && (
              <p className={`mt-2 ${TYPO.bodySm}`}>{fixture.matchBio}</p>
            )}
            {fixture.manOfTheMatch && (
              <p className="mt-2 text-sm text-gray-400">
                <span className="font-medium text-accent-gold">
                  Man of the Match:
                </span>{" "}
                {fixture.manOfTheMatch.playerName} —{" "}
                {fixture.manOfTheMatch.teamName}
                {fixture.manOfTheMatch.performanceSummary && (
                  <span className="text-gray-500">
                    {" "}
                    · {fixture.manOfTheMatch.performanceSummary}
                  </span>
                )}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {detail ? (
          <div className={SPACING.stackLg}>
            <TeamScoringBlock
              teamName={userTeamName}
              scoring={detail.dreamTeam}
              totalValue={userValue}
              averageRating={userAvgRating}
              tier={userTier}
              finalScore={fixture.pointsFor}
              userSquad={userSquad}
              isUserTeam
            />
            <TeamScoringBlock
              teamName={fixture.opponent}
              scoring={detail.opponent}
              totalValue={opponentSummary.totalValue}
              averageRating={opponentSummary.averageRating}
              tier={opponentSummary.tier}
              finalScore={fixture.pointsAgainst}
              isUserTeam={false}
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
  totalValue,
  averageRating,
  tier,
  finalScore,
  userSquad,
  isUserTeam,
}: {
  teamName: string;
  scoring: TeamScoringDetail;
  totalValue: number;
  averageRating: number;
  tier: string;
  finalScore: number;
  userSquad?: SquadSlot[];
  isUserTeam: boolean;
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackSm}>
      <ClubTeamLabel club={teamName} />
      <div className={`grid ${SPACING.cardGridGap} sm:grid-cols-2`}>
        <StatBox label="Squad Value" value={formatValue(totalValue)} size="sm" />
        <StatBox label="Team Tier" value={tier} size="sm" />
        <StatBox label="Avg Rating" value={averageRating.toFixed(1)} size="sm" />
        <StatBox
          label="Final Score"
          value={String(finalScore)}
          size="lg"
          className="border-accent-green/20"
        />
      </div>
      {hasTries && (
        <ScoringSection title="Tries">
          <TryScorerChips
            scorers={scoring.tryScorers.map((s) => {
              const slot = userSquad
                ? findSlotByPlayerId(userSquad, s.playerId)
                : undefined;
              const extras = formatPlayerLineExtras(slot);
              return {
                playerId: s.playerId,
                name: s.name,
                tries: s.tries,
                positionNote: extras.positionNote,
              };
            })}
            variant={isUserTeam ? "user" : "opponent"}
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
