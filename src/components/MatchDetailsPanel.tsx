"use client";

import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import type { SquadSlot } from "@/lib/types";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { TeamScoringBreakdown } from "./TeamScoringBreakdown";

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
  currentSeasonOnly = false,
  hideMatchStory = false,
}: MatchDetailsPanelProps) {
  const detail = fixture.scoringDetail;

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
                <p className={`mt-2 ${TYPO.bodySm}`}>{fixture.matchBio}</p>
              </div>
            )}
            {fixture.manOfTheMatch && (
              <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
                <p className={TYPO.sectionTitle}>Player of the Match</p>
                <p className={`mt-2 break-words ${TYPO.bodySm}`}>
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
        )}
      </div>
    </motion.div>
  );
}
