"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import {
  DREAM_TEAM_NAME,
  formatFixtureScore,
  type TeamScoringDetail,
} from "@/lib/game/season-simulation";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";
import { ClubTeamLabel } from "./ClubTeamLabel";

interface MatchDetailsPanelProps {
  fixture: MatchFixture;
  onClose: () => void;
  roundLabel?: string;
  /** User's team name — defaults to Dream Team for season mode. */
  userTeamName?: string;
}

export function MatchDetailsPanel({
  fixture,
  onClose,
  roundLabel,
  userTeamName = DREAM_TEAM_NAME,
}: MatchDetailsPanelProps) {
  const detail = fixture.scoringDetail;

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
            />
            <TeamScoringBlock
              teamName={fixture.opponent}
              scoring={detail.opponent}
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
}: {
  teamName: string;
  scoring: TeamScoringDetail;
}) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasConversions = (kicking?.conversions ?? 0) > 0;
  const hasPenalties = (kicking?.penalties ?? 0) > 0;
  const hasDropGoals = (kicking?.dropGoals ?? 0) > 0;

  if (!hasTries && !hasConversions && !hasPenalties && !hasDropGoals) {
    return null;
  }

  return (
    <div className="space-y-2">
      <ClubTeamLabel club={teamName} />
      {hasTries && (
        <ScoringSection title="Tries">
          <ul className="space-y-1">
            {scoring.tryScorers.flatMap((s) =>
              Array.from({ length: s.tries }, (_, i) => (
                <li
                  key={`${s.playerId}-${i}`}
                  className="text-sm font-medium text-white"
                >
                  {s.name}
                </li>
              ))
            )}
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
    </div>
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
