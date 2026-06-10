"use client";

import type { UiSurface } from "@/lib/ui/surfaces";
import { ClubNameLabel } from "./ClubNameLabel";

interface ClubTeamLabelProps {
  club: string;
  className?: string;
  surface?: UiSurface;
  compact?: boolean;
}

/** Dual-colour swatch + team name for match details and results. */
export function ClubTeamLabel({
  club,
  className = "",
  surface = "matchDetails",
  compact = false,
}: ClubTeamLabelProps) {
  return (
    <ClubNameLabel
      club={club}
      variant="row"
      compact={compact}
      surface={surface}
      className={className}
    />
  );
}
