"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import type { SquadSlot } from "@/lib/types";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";
import {
  buildMatchStoryFromEvents,
  normalizeMatchEvents,
} from "@/lib/game/match-events";
import { generateFantasyMatchBio } from "@/lib/game/fantasy-match-summary";

interface MatchDetailsPanelProps {
  fixture: MatchFixture;
  onClose: () => void;
  roundLabel?: string;
  seed: string;
  userSquad?: SquadSlot[];
  userTeamName?: string;
  userClubColorOverride?: string;
  eraClubLookup?: Record<string, string>;
  eraTeamRatings?: Record<string, number>;
  eraTeamValues?: Record<string, number>;
  /** Current Mode — opponent summary uses 2026 squad pool only. */
  currentSeasonOnly?: boolean;
  /** Hide match story (default — keeps the expand panel scannable). */
  hideMatchStory?: boolean;
  /** Hide MOTM when rendered separately above scoring. */
  hideMotm?: boolean;
  /** Scoring breakdown only — no header row or close button. */
  scoringOnly?: boolean;
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
  currentSeasonOnly: _currentSeasonOnly = false,
  hideMatchStory = true,
  hideMotm = false,
  scoringOnly = false,
}: MatchDetailsPanelProps) {
  const detail = fixture.scoringDetail;
  const matchId = `qm-r${fixture.round}-${fixture.opponent}`;

  const canonicalEvents = useMemo(
    () =>
      normalizeMatchEvents([], {
        matchId,
        userTeamId: userTeamName,
        opponentTeamId: fixture.opponent,
        userTeamName,
        opponentTeamName: fixture.opponent,
      }),
    [matchId, userTeamName, fixture.opponent]
  );

  const matchStory = useMemo(() => {
    if (hideMatchStory) return null;
    if (fixture.matchBio?.trim()) return fixture.matchBio;
    try {
      if (canonicalEvents.length > 0) {
        return buildMatchStoryFromEvents(canonicalEvents, userTeamName);
      }
      return generateFantasyMatchBio(fixture, seed, fixture.manOfTheMatch);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[MatchDetailsPanel] Match Story fallback failed", err);
      }
      return null;
    }
  }, [hideMatchStory, fixture, seed, canonicalEvents, userTeamName]);

  const scoringBlock = detail ? (
    <div className="divide-y divide-white/10">
      <div className="pb-2.5">
        <TeamScoringBreakdown
          teamName={userTeamName}
          colorClub={
            userClubColorOverride ??
            resolveEraTeamClubName(userTeamName, eraClubLookup)
          }
          scoring={detail.dreamTeam}
          userSquad={userSquad}
          variant="user"
          flat
        />
      </div>
      <div className="pt-2.5">
        <TeamScoringBreakdown
          teamName={fixture.opponent}
          colorClub={resolveEraTeamClubName(fixture.opponent, eraClubLookup)}
          scoring={detail.opponent}
          variant="opponent"
          flat
        />
      </div>
    </div>
  ) : (
    <p className={`text-center ${TYPO.bodySm}`}>Scoring data unavailable.</p>
  );

  if (scoringOnly) {
    return (
      <div className={CARD.base}>
        <div className="p-3 sm:p-4">
          <p className={`text-center ${TYPO.sectionLabel}`}>Scoring</p>
          <div className="mt-2.5">{scoringBlock}</div>
        </div>
      </div>
    );
  }

  const motm = fixture.manOfTheMatch;

  return (
    <motion.div
      className={`match-details-expand ${CARD.base} border-white/10`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="space-y-2.5 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <p className={`min-w-0 flex-1 text-center ${TYPO.keyLabel}`}>
            {roundLabel ?? `Round ${fixture.round}`}
            {!fixture.isNeutral ? (
              <> · {fixture.isHome ? "Home" : "Away"}</>
            ) : null}
          </p>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoringBlock}

        {motm && !hideMotm ? (
          <p className={`text-center ${TYPO.bodySm}`}>
            <span className="text-pitch-500">POTM </span>
            <span className="font-semibold text-white">{motm.playerName}</span>
            {motm.performanceSummary ? (
              <span className="text-pitch-400"> · {motm.performanceSummary}</span>
            ) : null}
          </p>
        ) : null}

        {matchStory ? (
          <p className={`whitespace-pre-line text-center ${TYPO.meta}`}>
            {matchStory}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
