"use client";

import { getClubColors } from "@/lib/clubs";
import { DREAM_TEAM_COLORS } from "@/lib/clubs/dream-team";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { getLuminance } from "@/lib/ui/contrast";

interface TryScorerClubBadgeProps {
  club: string;
  className?: string;
}

/** Colour-only club pill beside a try-scorer name (no club text). */
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
  const lowContrast =
    getLuminance(colors.primary) < 0.1 || getLuminance(colors.secondary) < 0.1;

  return (
    <span
      title={club}
      aria-hidden
      className={`inline-flex h-2.5 w-5 shrink-0 overflow-hidden rounded-full shadow-sm ring-1 ${
        lowContrast ? "ring-white/25" : "ring-white/15"
      } ${className}`}
    >
      <span className="h-full w-1/2" style={{ backgroundColor: colors.primary }} />
      <span
        className="h-full w-1/2"
        style={{ backgroundColor: colors.secondary }}
      />
    </span>
  );
}
