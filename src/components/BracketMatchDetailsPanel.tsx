"use client";

import { motion } from "framer-motion";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import type { TeamScoringDetail } from "@/lib/game/season-simulation";
import { RL_INFO_BOX_CLASS } from "./cards/rl-card";
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

  return (
    <motion.div
      className="match-details-expand mt-4 overflow-hidden rounded-lg border border-accent-green/30 bg-pitch-900/80 shadow-lg"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-wider text-accent-green">
              {getCupRoundLabel(match.round)} · Match Details
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start sm:gap-3">
              <ClubNameLabel club={match.homeTeam} variant="inline" />
              <span className="font-display text-base font-black text-white sm:text-lg">
                {match.homeScore} – {match.awayScore}
              </span>
              <ClubNameLabel club={match.awayTeam} variant="inline" />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-pitch-600 px-2 py-1 text-[10px] text-gray-400 transition hover:text-white"
          >
            Close
          </button>
        </div>

        {scoring ? (
          <div className="space-y-4">
            <TeamScoringBlock teamName={match.homeTeam} scoring={scoring.home} />
            <TeamScoringBlock teamName={match.awayTeam} scoring={scoring.away} />
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

  return (
    <div className="space-y-2">
      <ClubTeamLabel club={teamName} />
      {hasTries ? (
        <div className={`${RL_INFO_BOX_CLASS} p-3`}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Try Scorers
          </p>
          <ul className="space-y-1">
            {scoring.tryScorers.map((s) => (
              <li
                key={s.playerId}
                className="flex justify-between text-sm text-gray-300"
              >
                <span>{s.name}</span>
                <span className="font-bold text-accent-green">
                  {s.tries} {s.tries === 1 ? "try" : "tries"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No tries scored.</p>
      )}
      {kicking && (
        <div className={`${RL_INFO_BOX_CLASS} p-3`}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Kicking
          </p>
          <p className="text-sm text-gray-300">{kicking.name}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
            {kicking.conversions > 0 && (
              <span>
                Conversions: {kicking.conversions}/{kicking.conversionAttempts}
              </span>
            )}
            {kicking.penalties > 0 && (
              <span>Penalties: {kicking.penalties}</span>
            )}
            {kicking.dropGoals > 0 && (
              <span>Drop Goals: {kicking.dropGoals}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
