"use client";

import { getClubColors } from "@/lib/clubs";
import { DREAM_TEAM_COLORS } from "@/lib/clubs/dream-team";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { getReadableTextColor, getClubPillStyle } from "@/lib/ui/contrast";
import { UI_SURFACES, type UiSurface } from "@/lib/ui/surfaces";
import { TYPO } from "@/lib/ui/typography";
import { ClubDualSwatch } from "./ClubDualSwatch";

export interface ClubNameLabelProps {
  club: string;
  /** Row with swatch (default), coloured pill, or minimal inline accent. */
  variant?: "row" | "pill" | "inline";
  compact?: boolean;
  /** Show 3-letter club code beside name in compact row mode. */
  showAbbreviation?: boolean;
  align?: "left" | "right";
  surface?: UiSurface;
  showAccent?: boolean;
  className?: string;
}

function resolveColors(club: string) {
  return club === DREAM_TEAM_NAME
    ? {
        primary: DREAM_TEAM_COLORS.primary,
        secondary: DREAM_TEAM_COLORS.secondary,
        shortName: "DT",
      }
    : getClubColors(club);
}

export function ClubNameLabel({
  club,
  variant = "row",
  compact = false,
  showAbbreviation = false,
  align = "left",
  surface = "matchDetails",
  showAccent = true,
  className = "",
}: ClubNameLabelProps) {
  const colors = resolveColors(club);
  const isRight = align === "right";

  if (variant === "pill") {
    const pillStyle = getClubPillStyle(
      colors.primary,
      colors.secondary,
      "accent" in colors ? (colors as { accent?: string }).accent : undefined
    );
    return (
      <span
        title={club}
        className={`inline-block max-w-full truncate rounded px-2 py-0.5 ${TYPO.clubName} ${className}`}
        style={pillStyle}
      >
        {club}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span
        title={club}
        className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}
      >
        <span
          className="h-3 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: colors.primary }}
          aria-hidden
        />
        <span className={`min-w-0 truncate ${TYPO.identityLine}`}>{club}</span>
      </span>
    );
  }

  const textColor = getReadableTextColor(UI_SURFACES[surface]);
  const swatchSize = compact ? "sm" : "md";
  const nameClass = compact
    ? "line-clamp-2 text-[11px] leading-snug sm:text-xs"
    : "text-xs leading-snug sm:text-sm";

  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        isRight ? "flex-row-reverse text-right" : ""
      } ${className}`}
      style={
        showAccent
          ? {
              borderLeft: isRight ? undefined : `3px solid ${colors.primary}`,
              borderRight: isRight ? `3px solid ${colors.primary}` : undefined,
              paddingLeft: isRight ? 0 : "0.625rem",
              paddingRight: isRight ? "0.625rem" : 0,
            }
          : undefined
      }
    >
      <ClubDualSwatch
        club={club}
        primary={colors.primary}
        secondary={colors.secondary}
        size={swatchSize}
      />
      <div className="min-w-0 flex-1">
        {compact && showAbbreviation && colors.shortName !== "???" && (
          <span
            className={`mb-0.5 inline-block rounded bg-pitch-800/80 px-1 py-px ${TYPO.statLabel}`}
            title={club}
          >
            {colors.shortName}
          </span>
        )}
        <p
          title={club}
          className={`min-w-0 break-words font-display font-bold uppercase tracking-wide ${nameClass}`}
          style={{ color: textColor }}
        >
          {club}
        </p>
      </div>
    </div>
  );
}
