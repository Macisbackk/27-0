"use client";

import { getClubColors } from "@/lib/clubs";
import { DREAM_TEAM_COLORS } from "@/lib/clubs/dream-team";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { getClubPanelTextStyle } from "@/lib/ui/contrast";

interface TryScorerClubBadgeProps {
  club: string;
  className?: string;
}

/** Club name pill with automatic contrast on club primary colour. */
export function TryScorerClubBadge({
  club,
  className = "",
}: TryScorerClubBadgeProps) {
  const colors =
    club === DREAM_TEAM_NAME
      ? {
          primary: DREAM_TEAM_COLORS.primary,
          secondary: DREAM_TEAM_COLORS.secondary,
        }
      : getClubColors(club);
  const textStyle = getClubPanelTextStyle(colors.primary);

  return (
    <span
      className={`inline-block max-w-full truncate rounded px-2 py-0.5 text-[11px] font-semibold sm:text-xs ${className}`}
      style={{
        backgroundColor: colors.primary,
        color: textStyle.color,
        textShadow: textStyle.textShadow,
        WebkitTextStroke: textStyle.useStroke
          ? "0.3px rgba(0,0,0,0.35)"
          : undefined,
      }}
    >
      {club}
    </span>
  );
}
