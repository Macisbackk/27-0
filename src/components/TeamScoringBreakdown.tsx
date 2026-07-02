"use client";

import type { TeamScoringDetail } from "@/lib/game/season-simulation";
import {
  findSlotByPlayerId,
  formatPlayerLineExtras,
} from "@/lib/squad-display";
import type { SquadSlot } from "@/lib/types";
import { ClubTeamLabel } from "./ClubTeamLabel";
import { KickingSummarySection } from "./KickingSummarySection";
import { TeamColouredScoringSection } from "./TeamColouredScoringSection";
import { TryScorerChips, TryScorersEmptyNote } from "./TryScorerChips";
import { TYPO } from "@/lib/ui/typography";

interface TeamScoringBreakdownProps {
  teamName: string;
  colorClub: string;
  scoring: TeamScoringDetail;
  userSquad?: SquadSlot[];
  variant?: "user" | "opponent";
}

/** Compact tries + kicking breakdown for match detail panels. */
export function TeamScoringBreakdown({
  teamName,
  colorClub,
  scoring,
  userSquad,
  variant = "user",
}: TeamScoringBreakdownProps) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasKicking =
    (kicking?.conversions ?? 0) > 0 ||
    (kicking?.penalties ?? 0) > 0 ||
    (kicking?.dropGoals ?? 0) > 0;

  if (!hasTries && !hasKicking) {
    return (
      <div className="space-y-2">
        <ClubTeamLabel club={teamName} colorClub={colorClub} compact />
        <TryScorersEmptyNote />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ClubTeamLabel club={teamName} colorClub={colorClub} compact />
      <TeamColouredScoringSection colorClub={colorClub} compact>
        <div className="space-y-2">
          {hasTries && (
            <div>
              <p className={TYPO.statLabel}>Tries</p>
              <div className="mt-0.5">
                <TryScorerChips
                  compact
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
                  variant={variant}
                />
              </div>
            </div>
          )}
          {hasTries && hasKicking && (
            <div className="border-t border-pitch-700/35" aria-hidden />
          )}
          {hasKicking && (
            <KickingSummarySection kicking={kicking} bare compact />
          )}
        </div>
      </TeamColouredScoringSection>
    </div>
  );
}
