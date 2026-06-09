"use client";

import { getClubColors } from "@/lib/clubs";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { DREAM_TEAM_COLORS } from "@/lib/clubs/dream-team";

interface ClubDualSwatchProps {
  club: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  primary?: string;
  secondary?: string;
}

const SIZE_CLASS = {
  xs: "h-2.5 w-5",
  sm: "h-3 w-6",
  md: "h-4 w-8",
} as const;

/** Equal split primary | secondary club colour indicator. */
export function ClubDualSwatch({
  club,
  size = "sm",
  className = "",
  primary,
  secondary,
}: ClubDualSwatchProps) {
  const colors =
    primary && secondary
      ? { primary, secondary }
      : club === DREAM_TEAM_NAME
        ? {
            primary: DREAM_TEAM_COLORS.primary,
            secondary: DREAM_TEAM_COLORS.secondary,
          }
        : getClubColors(club);
  const dim = SIZE_CLASS[size];

  return (
    <div
      className={`flex shrink-0 overflow-hidden rounded-sm border border-black/10 ${dim} ${className}`}
      title={club}
    >
      <span
        className="h-full w-1/2"
        style={{ backgroundColor: colors.primary }}
      />
      <span
        className="h-full w-1/2"
        style={{ backgroundColor: colors.secondary }}
      />
    </div>
  );
}
