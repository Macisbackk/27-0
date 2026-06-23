"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import {
  DREAM_TEAM_NAME,
  type TeamScoringDetail,
} from "@/lib/game/season-simulation";
import { getOpponentTeamSummary } from "@/lib/game/opponent-scorers";
import { getEraTeamByDisplayName } from "@/lib/players/era-teams";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import {
  findSlotByPlayerId,
  formatPlayerLineExtras,
} from "@/lib/squad-display";
import type { SquadSlot } from "@/lib/types";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
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
  /** Era mode: club colours for the user's team label. */
  userClubColorOverride?: string;
  eraClubLookup?: Record<string, string>;
  eraTeamRatings?: Record<string, number>;
  eraTeamValues?: Record<string, number>;
}

export function MatchDetailsPanel({
  fixture,
  onClose,
  roundLabel,
  seed,
  userSquad,
  userTeamName = DREAM_TEAM_NAME,
  userClubColorOverride,
  eraClubLookup,
  eraTeamRatings,
  eraTeamValues,
}: MatchDetailsPanelProps) {
  const detail = fixture.scoringDetail;
  const userAvgRating = userSquad ? getAverageSquadRating(userSquad) : 0;
  const eraOpponent = eraClubLookup
    ? getEraTeamByDisplayName(fixture.opponent)
    : null;
  const opponentSummary =
    eraOpponent && eraTeamRatings?.[fixture.opponent] !== undefined
      ? {
          name: fixture.opponent,
          averageRating: eraTeamRatings[fixture.opponent],
        }
      : getOpponentTeamSummary(fixture.opponent, seed, fixture.round);

  return (
    <motion.div
      className={`match-details-expand overflow-hidden ${CARD.base} border-accent-green/30 shadow-lg`}
      initial={{ height: 0, opacity: 0, marginTop: 0 }}
      animate={{ height: "auto", opacity: 1, marginTop: 4 }}
      exit={{ height: 0, opacity: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className={`${SPACING.cardPadding} ${SPACING.stackLg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 flex-1 ${SPACING.stackSm}`}>
            <p className={TYPO.sectionLabel}>
              {roundLabel ?? `Round ${fixture.round}`} · Match Details
            </p>
            <div
              className={`${CARD.stat} ${SPACING.cardPaddingSm} flex flex-wrap items-center justify-center gap-2 sm:justify-start`}
            >
              <span
                className={`${TYPO.cardTitle} whitespace-nowrap ${
                  fixture.result === "W" ? "text-accent-green" : "text-red-400"
                }`}
              >
                {fixture.pointsFor} – {fixture.pointsAgainst}
              </span>
              <span className={`${TYPO.bodySm} text-gray-400`}>vs</span>
              <span className={`${TYPO.bodySm} break-words text-gray-300`}>
                {fixture.opponent}
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {fixture.isNeutral
                ? "Neutral"
                : fixture.isHome
                  ? "Home"
                  : "Away"}
            </p>
            {fixture.matchBio && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Match Bio</p>
                <p className={`mt-2 ${TYPO.bodySm}`}>{fixture.matchBio}</p>
              </div>
            )}
            {fixture.manOfTheMatch && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Player of the Match</p>
                <p className={`mt-2 ${TYPO.bodySm}`}>
                  {fixture.manOfTheMatch.playerName} —{" "}
                  {fixture.manOfTheMatch.teamName}
                  {fixture.manOfTheMatch.performanceSummary && (
                    <span className="text-gray-500">
                      {" "}
                      · {fixture.manOfTheMatch.performanceSummary}
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

        {detail ? (
          <div className={SPACING.stackLg}>
            <TeamScoringBlock
              teamName={userTeamName}
              colorClub={
                userClubColorOverride ??
                resolveEraTeamClubName(userTeamName, eraClubLookup)
              }
              scoring={detail.dreamTeam}
              averageRating={userAvgRating}
              userSquad={userSquad}
              isUserTeam
            />
            <TeamScoringBlock
              teamName={fixture.opponent}
              colorClub={resolveEraTeamClubName(fixture.opponent, eraClubLookup)}
              scoring={detail.opponent}
              averageRating={opponentSummary.averageRating}
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
  colorClub,
  scoring,
  averageRating,
  userSquad,
  isUserTeam,
}: {
  teamName: string;
  colorClub: string;
  scoring: TeamScoringDetail;
  averageRating: number;
  userSquad?: SquadSlot[];
  isUserTeam: boolean;
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className={SPACING.stackMd}>
      <ClubTeamLabel club={teamName} colorClub={colorClub} />
      <p className={`${TYPO.bodySm} text-gray-400`}>
        {averageRating > 0 ? `${averageRating.toFixed(1)} avg rating` : "—"}
      </p>
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
