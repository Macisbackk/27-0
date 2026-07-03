"use client";

import { motion } from "framer-motion";
import type { MatchFixture } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import type { SquadSlot } from "@/lib/types";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { CARD, BTN, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
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
  seed: _seed,
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
                <p className={`mt-2 whitespace-pre-line ${TYPO.bodySm}`}>{fixture.matchBio}</p>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className={BTN.closeSm}>
            Close
          </button>
        </div>

        {scoringBlock}

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
