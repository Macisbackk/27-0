"use client";

import type { UiSurface } from "@/lib/ui/surfaces";
import { ClubNameLabel } from "./ClubNameLabel";

interface ClubTeamLabelProps {
  club: string;
  className?: string;
  surface?: UiSurface;
  compact?: boolean;
  colorClub?: string;
}

/** Dual-colour swatch + team name for match details and results. */
export function ClubTeamLabel({
  club,
  className = "",
  surface = "matchDetails",
  compact = false,
  colorClub,
}: ClubTeamLabelProps) {
  return (
    <ClubNameLabel
      club={club}
      colorClub={colorClub}
      variant="row"
      compact={compact}
      surface={surface}
      className={className}
    />
  );
}
