"use client";

import { getClubColors } from "@/lib/clubs";
import { DREAM_TEAM_COLORS } from "@/lib/clubs/dream-team";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES, type UiSurface } from "@/lib/ui/surfaces";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface ClubTeamLabelProps {
  club: string;
  className?: string;
  surface?: UiSurface;
}

/** Dual-colour swatch + team name for match details and results. */
export function ClubTeamLabel({
  club,
  className = "",
  surface = "matchDetails",
}: ClubTeamLabelProps) {
  const colors =
    club === DREAM_TEAM_NAME
      ? {
          primary: DREAM_TEAM_COLORS.primary,
          secondary: DREAM_TEAM_COLORS.secondary,
        }
      : getClubColors(club);
  const textColor = getReadableTextColor(UI_SURFACES[surface]);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ClubDualSwatch
        club={club}
        primary={colors.primary}
        secondary={colors.secondary}
        size="md"
      />
      <span
        className="min-w-0 break-words font-display text-xs font-bold uppercase leading-snug tracking-wide sm:text-sm"
        style={{ color: textColor }}
      >
        {club}
      </span>
    </div>
  );
}
