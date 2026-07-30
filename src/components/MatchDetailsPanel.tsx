"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import type { SquadSlot } from "@/lib/types";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { generateSimulatedMatchEvents } from "@/lib/manager/matchEventGenerator";
import { ManagerMatchEventLine } from "@/components/manager/ManagerMatchEventLine";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";
import { MatchPlayerOfTheMatchCard } from "./MatchPlayerOfTheMatchCard";

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
  /** Hide match story when shown elsewhere (e.g. manager match review). */
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
  hideMatchStory = false,
  hideMotm = false,
  scoringOnly = false,
}: MatchDetailsPanelProps) {
  const detail = fixture.scoringDetail;

  const matchEvents = useMemo(
    () =>
      generateSimulatedMatchEvents({
        seed,
        fixtureKey: `qm-r${fixture.round}-${fixture.opponent}`,
        userClub: userTeamName,
        opponent: fixture.opponent,
        userScore: fixture.pointsFor,
        oppScore: fixture.pointsAgainst,
        userTries: fixture.triesFor,
        oppTries: fixture.triesAgainst,
        userScorers:
          detail?.dreamTeam.tryScorers.map((s) => ({ name: s.name })) ?? [],
      }),
    [
      seed,
      fixture.round,
      fixture.opponent,
      fixture.pointsFor,
      fixture.pointsAgainst,
      fixture.triesFor,
      fixture.triesAgainst,
      userTeamName,
      detail,
    ]
  );

  const scoringBlock = detail ? (
    <div className="space-y-4">
      <TeamScoringBreakdown
        teamName={userTeamName}
        colorClub={
          userClubColorOverride ??
          resolveEraTeamClubName(userTeamName, eraClubLookup)
        }
        scoring={detail.dreamTeam}
        userSquad={userSquad}
        variant="user"
      />
      <TeamScoringBreakdown
        teamName={fixture.opponent}
        colorClub={resolveEraTeamClubName(fixture.opponent, eraClubLookup)}
        scoring={detail.opponent}
        variant="opponent"
      />
    </div>
  ) : (
    <p className={TYPO.body}>Scoring data unavailable.</p>
  );

  if (scoringOnly) {
    return (
      <motion.div
        className={`match-details-expand overflow-hidden ${CARD.base}`}
        initial={{ height: 0, opacity: 0, marginTop: 0 }}
        animate={{ height: "auto", opacity: 1, marginTop: 0 }}
        exit={{ height: 0, opacity: 0, marginTop: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className={SPACING.cardPadding}>
          <p className={TYPO.sectionLabel}>Scoring</p>
          <div className="mt-3">{scoringBlock}</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`match-details-expand overflow-hidden ${CARD.base} border-theme-primary/30 shadow-lg`}
      initial={{ height: 0, opacity: 0, marginTop: 0 }}
      animate={{ height: "auto", opacity: 1, marginTop: 4 }}
      exit={{ height: 0, opacity: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className={`${SPACING.cardPadding} ${SPACING.stackLg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 flex-1 ${SPACING.stackMd}`}>
            <p className={TYPO.sectionLabel}>
              {roundLabel ?? `Round ${fixture.round}`} · Match Details
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {!fixture.isNeutral && (
                <>{fixture.isHome ? "Home" : "Away"} · </>
              )}
              vs {fixture.opponent}
            </p>
            {fixture.matchBio && !hideMatchStory && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Match Story</p>
                <p className={`mt-2 whitespace-pre-line ${TYPO.bodySm}`}>{fixture.matchBio}</p>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoringBlock}

        {matchEvents.length > 0 ? (
          <div>
            <p className={TYPO.sectionLabel}>Match Events</p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-pitch-700/40 bg-pitch-950/40 p-2">
              {matchEvents
                .filter((e) => e.type !== "half_time" && e.type !== "full_time")
                .map((event, index) => (
                  <ManagerMatchEventLine
                    key={event.id ?? `${event.minute}-${index}`}
                    event={event}
                    userClub={userTeamName}
                    opponentClub={fixture.opponent}
                  />
                ))}
            </ul>
          </div>
        ) : null}

        {fixture.manOfTheMatch && !hideMotm && (
          <MatchPlayerOfTheMatchCard
            motm={fixture.manOfTheMatch}
            userClub={userTeamName}
          />
        )}
      </div>
    </motion.div>
  );
}
