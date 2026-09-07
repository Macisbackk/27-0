"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import type { SquadSlot } from "@/lib/types";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";
import { MatchPlayerOfTheMatchCard } from "./MatchPlayerOfTheMatchCard";
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
  /** Hide match story when shown elsewhere. */
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
  }, [
    hideMatchStory,
    fixture,
    seed,
    canonicalEvents,
    userTeamName,
  ]);

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
    // No height collapse animation — Match Review keeps this panel in a
    // `hidden` mobile tab, which measures height as 0 and can clip scorers.
    return (
      <div className={CARD.base}>
        <div className={SPACING.cardPadding}>
          <p className={TYPO.sectionLabel}>Scoring</p>
          <div className="mt-3">{scoringBlock}</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`match-details-expand ${CARD.base} border-theme-primary/30 shadow-lg`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
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
            {matchStory && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Match Story</p>
                <p className={`mt-2 whitespace-pre-line ${TYPO.bodySm}`}>
                  {matchStory}
                </p>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoringBlock}

        {canonicalEvents.length > 0 ? (
          <div>
            <p className={TYPO.sectionLabel}>Match Events</p>
            <ul className="mt-2 divide-y divide-pitch-700/30">
              {canonicalEvents
                .filter((e) => e.type !== "half_time" && e.type !== "full_time")
                .map((event, index) => (
                  <li
                    key={event.id ?? `${event.minute}-${index}`}
                    className="py-1.5 text-sm text-pitch-200"
                  >
                    <span className="tabular-nums text-pitch-400">
                      {event.minute}&apos;
                    </span>{" "}
                    {event.description}
                  </li>
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
