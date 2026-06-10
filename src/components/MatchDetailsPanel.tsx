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
import { ClubNameLabel } from "./ClubNameLabel";
import {
  findSlotByPlayerId,
  formatPlayerLineExtras,
} from "@/lib/squad-display";
import { getSquadValue } from "@/lib/positions";
import type { SquadSlot } from "@/lib/types";
import { RL_INFO_BOX_CLASS, RLTierBadge } from "./cards/rl-card";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { TryScorerClubBadge } from "./TryScorerClubBadge";

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
      className="match-details-expand overflow-hidden rounded-lg border border-accent-green/30 bg-pitch-900/80 shadow-lg"
      initial={{ height: 0, opacity: 0, marginTop: 0 }}
      animate={{ height: "auto", opacity: 1, marginTop: 4 }}
      exit={{ height: 0, opacity: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-green">
              {roundLabel ?? `Round ${fixture.round}`} · Match Details
            </p>
            <p className="mt-1 font-display text-base font-bold text-white sm:text-lg">
              {formatFixtureScore(fixture)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-pitch-600 px-2 py-1 text-[10px] text-gray-400 transition hover:text-white"
          >
            Close
          </button>
        </div>

        {detail ? (
          <div className="space-y-4">
            <TeamScoringBlock
              teamName={userTeamName}
              scoring={detail.dreamTeam}
              totalValue={userValue}
              averageRating={userAvgRating}
              tier={userTier}
              finalScore={fixture.pointsFor}
              userSquad={userSquad}
            />
            <TeamScoringBlock
              teamName={fixture.opponent}
              scoring={detail.opponent}
              totalValue={opponentSummary.totalValue}
              averageRating={opponentSummary.averageRating}
              tier={opponentSummary.tier}
              finalScore={fixture.pointsAgainst}
              oppositionLabel
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">Scoring data unavailable.</p>
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
  oppositionLabel,
}: {
  teamName: string;
  scoring: TeamScoringDetail;
  totalValue: number;
  averageRating: number;
  tier: string;
  finalScore: number;
  userSquad?: SquadSlot[];
  oppositionLabel?: boolean;
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  return (
    <div className="space-y-2">
      <ClubTeamLabel club={teamName} />
      {oppositionLabel && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Opposition
          </span>
          <ClubNameLabel club={teamName} variant="inline" />
          <span className="text-gray-600">·</span>
          <span className="font-display font-bold text-white">
            {averageRating.toFixed(1)} OVR
          </span>
        </div>
      )}
      <div className={`${RL_INFO_BOX_CLASS} grid gap-1 p-3 text-xs sm:grid-cols-2`}>
        <TeamStat label="Squad Value" value={formatValue(totalValue)} />
        <TeamStat label="Team Tier" value={tier} />
        <TeamStat label="Avg Rating" value={averageRating.toFixed(1)} />
        <TeamStat label="Final Score" value={String(finalScore)} highlight />
      </div>
      {hasTries && (
        <ScoringSection title="Tries">
          <ul className="space-y-1">
            {scoring.tryScorers.flatMap((s) => {
              const slot = userSquad
                ? findSlotByPlayerId(userSquad, s.playerId)
                : undefined;
              const extras = formatPlayerLineExtras(slot);
              const suffix = [
                extras.positionNote,
                extras.ratingNote,
              ]
                .filter(Boolean)
                .join(" · ");
              const club = slot?.player?.club;
              return Array.from({ length: s.tries }, (_, i) => (
                <li
                  key={`${s.playerId}-${i}`}
                  className="rounded-lg border border-pitch-700/40 bg-pitch-950/50 px-2.5 py-2"
                >
                  <p className="text-sm font-medium text-white">{s.name}</p>
                  {club && (
                    <div className="mt-1">
                      <TryScorerClubBadge club={club} />
                    </div>
                  )}
                  {suffix && (
                    <p className="mt-1 text-xs text-gray-400">{suffix}</p>
                  )}
                </li>
              ));
            })}
          </ul>
        </ScoringSection>
      )}
      {hasConversions && kicking && (
        <ScoringSection title="Conversions">
          <p className="text-sm font-medium text-white">
            {kicking.name} ({kicking.conversions}/{kicking.conversionAttempts})
          </p>
        </ScoringSection>
      )}
      {hasPenalties && kicking && (
        <ScoringSection title="Penalties">
          <p className="text-sm font-medium text-white">
            {kicking.name} ({kicking.penalties})
          </p>
        </ScoringSection>
      )}
      {hasDropGoals && kicking && (
        <ScoringSection title="Drop Goals">
          <p className="text-sm font-medium text-white">
            {kicking.name} ({kicking.dropGoals})
          </p>
        </ScoringSection>
      )}
      {!hasTries && !hasConversions && !hasPenalties && !hasDropGoals && (
        <p className="text-xs text-gray-500">No scoring breakdown recorded.</p>
      )}
    </div>
  );
}

function TeamStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  if (label === "Team Tier") {
    return (
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="shrink-0 text-gray-500">{label}:</span>
        <RLTierBadge highlight={highlight}>{value}</RLTierBadge>
      </div>
    );
  }

  return (
    <p className="min-w-0 text-gray-500">
      {label}:{" "}
      <span
        className={
          highlight ? "font-semibold text-accent-green" : "break-words text-white"
        }
      >
        {value}
      </span>
    </p>
  );
}

function ScoringSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${RL_INFO_BOX_CLASS} p-3`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-accent-green">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
