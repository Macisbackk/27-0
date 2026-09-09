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
  /** Flat list without coloured card chrome — for compact match expands. */
  flat?: boolean;
}

/** Compact tries + goals breakdown for match detail panels. */
export function TeamScoringBreakdown({
  teamName,
  colorClub,
  scoring,
  userSquad,
  variant = "user",
  flat = false,
}: TeamScoringBreakdownProps) {
  const hasTries = scoring.tryScorers.length > 0;
  const kicking = scoring.kicking;
  const hasKicking =
    (kicking?.conversions ?? 0) > 0 ||
    (kicking?.penalties ?? 0) > 0 ||
    (kicking?.dropGoals ?? 0) > 0;

  if (!hasTries && !hasKicking) {
    return (
      <div className={flat ? "space-y-2 text-center sm:text-left" : "space-y-2"}>
        <ClubTeamLabel
          club={teamName}
          colorClub={colorClub}
          compact
          className={flat ? "justify-center sm:justify-start" : undefined}
        />
        <TryScorersEmptyNote />
      </div>
    );
  }

  const tryBlock = hasTries ? (
    <div className="space-y-1.5">
      <p className={TYPO.statLabel}>Tries</p>
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
  ) : null;

  const kickBlock = hasKicking ? (
    <KickingSummarySection kicking={kicking} bare compact />
  ) : null;

  if (flat) {
    return (
      <div className="space-y-2 text-center sm:text-left">
        <ClubTeamLabel
          club={teamName}
          colorClub={colorClub}
          compact
          className="justify-center sm:justify-start"
        />
        <div className="space-y-2.5">
          {tryBlock}
          {kickBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ClubTeamLabel club={teamName} colorClub={colorClub} compact />
      <TeamColouredScoringSection colorClub={colorClub} compact>
        <div className="space-y-2.5">
          {tryBlock}
          {hasTries && hasKicking && (
            <div className="border-t border-white/10" aria-hidden />
          )}
          {kickBlock}
        </div>
      </TeamColouredScoringSection>
    </div>
  );
}
