import type { ClubColorSet } from "@/lib/clubs";
import {
  getClubColors,
  getClubHeaderBarStyle,
  getClubIdentityStripStyle,
  getClubLogoBoxStyle,
  getClubTheme,
} from "@/lib/clubs";

export type ClubLogoSize = "xs" | "sm" | "md" | "lg";

const LOGO_SIZE: Record<ClubLogoSize, { box: string; text: string }> = {
  xs: { box: "h-8 w-8", text: "text-[9px]" },
  sm: { box: "h-10 w-10", text: "text-[10px]" },
  md: { box: "h-12 w-12", text: "text-[11px]" },
  lg: { box: "h-14 w-14", text: "text-xs" },
};

const HEADER_SIZE: Record<"sm" | "md" | "lg" | "pitch", { bar: string; text: string }> = {
  sm: { bar: "h-5", text: "text-[9px]" },
  md: { bar: "h-6", text: "text-[11px]" },
  lg: { bar: "h-8", text: "text-sm" },
  pitch: { bar: "h-5", text: "text-[9px]" },
};

interface ClubLogoBoxProps {
  club: string;
  colors?: ClubColorSet;
  size?: ClubLogoSize;
  className?: string;
  /** Show club abbreviation inside logo — pitch cards only. */
  showAbbrev?: boolean;
}

/** Two-tone club logo — primary + secondary panels with abbreviation. */
export function ClubLogoBox({
  club,
  colors: colorsProp,
  size = "md",
  className = "",
  showAbbrev = true,
}: ClubLogoBoxProps) {
  const theme = getClubTheme(club);
  const colors = colorsProp ?? theme.colors;
  const initials = colors.shortName;
  const dim = LOGO_SIZE[size];

  return (
    <div
      className={`club-logo-box relative flex ${dim.box} shrink-0 overflow-hidden rounded-md border-2 ${className}`}
      style={getClubLogoBoxStyle(club)}
      title={club}
    >
      <div
        className="absolute inset-y-0 left-0 w-[55%]"
        style={{ backgroundColor: colors.primary }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[45%]"
        style={{ backgroundColor: colors.secondary }}
      />
      {colors.accent && (
        <div
          className="absolute left-0 top-0 z-10 h-1.5 w-full"
          style={{ backgroundColor: colors.accent }}
        />
      )}
      {showAbbrev && (
        <span
          className={`relative z-10 m-auto club-abbrev-stroke-thick font-display font-black leading-none text-white ${dim.text}`}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

/** Two-tone colour bar without abbreviation — recruitment cards. */
export function ClubColourBar({ club }: { club: string }) {
  const colors = getClubColors(club);
  return (
    <div className="flex h-1.5 w-full shrink-0 overflow-hidden">
      <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
      <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      {colors.accent && (
        <span className="h-full w-1" style={{ backgroundColor: colors.accent }} />
      )}
    </div>
  );
}

interface ClubHeaderBarProps {
  club: string;
  colors?: ClubColorSet;
  size?: "sm" | "md" | "lg" | "pitch";
  thick?: boolean;
}

/** Full-width club header — primary background + secondary stripe. */
export function ClubHeaderBar({
  club,
  colors: colorsProp,
  size = "md",
  thick = false,
}: ClubHeaderBarProps) {
  const colors = colorsProp ?? getClubColors(club);
  const dim = HEADER_SIZE[size];
  const strokeClass = thick ? "club-abbrev-stroke-thick" : "club-abbrev-stroke";

  return (
    <div
      className={`club-header-bar flex w-full ${dim.bar} shrink-0 items-center justify-center`}
      style={getClubHeaderBarStyle(club)}
      title={club}
    >
      <span
        className={`${strokeClass} font-display font-black leading-none ${dim.text}`}
        style={{ color: "inherit" }}
      >
        {colors.shortName}
      </span>
    </div>
  );
}

interface ClubIdentityStripProps {
  club: string;
  colors?: ClubColorSet;
  logoSize?: ClubLogoSize;
  showClubName?: boolean;
  showLogoAbbrev?: boolean;
  compact?: boolean;
}

/** Club name strip — colours only, no logo badge. */
export function ClubNameStrip({
  club,
  colors: colorsProp,
  compact,
}: {
  club: string;
  colors?: ClubColorSet;
  compact?: boolean;
}) {
  const colors = colorsProp ?? getClubColors(club);

  return (
    <div
      className={`club-name-strip flex min-w-0 items-center ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
      style={getClubIdentityStripStyle(club)}
    >
      <div className="mr-2 flex shrink-0 overflow-hidden rounded-sm">
        <span
          className="h-3 w-3 sm:h-3.5 sm:w-3.5"
          style={{ backgroundColor: colors.primary }}
        />
        <span
          className="h-3 w-3 sm:h-3.5 sm:w-3.5"
          style={{ backgroundColor: colors.secondary }}
        />
      </div>
      <span
        className={`min-w-0 flex-1 break-words font-display font-bold uppercase leading-snug tracking-wide ${
          compact ? "text-[9px]" : "text-[10px] sm:text-xs"
        }`}
        style={{ color: "inherit" }}
      >
        {club}
      </span>
    </div>
  );
}

/** Logo + club name strip beneath header for instant recognition. */
export function ClubIdentityStrip({
  club,
  colors: colorsProp,
  logoSize = "sm",
  showClubName = true,
  showLogoAbbrev = true,
  compact,
}: ClubIdentityStripProps) {
  const colors = colorsProp ?? getClubColors(club);

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "px-1.5 py-1" : "px-2.5 py-1.5"}`}
      style={getClubIdentityStripStyle(club)}
    >
      <ClubLogoBox
        club={club}
        colors={colors}
        size={logoSize}
        showAbbrev={showLogoAbbrev}
      />
      {showClubName && (
        <span
          className={`min-w-0 break-words font-display font-bold uppercase leading-snug tracking-wide ${
            compact ? "text-[8px]" : "text-[10px] sm:text-xs"
          }`}
          style={{ color: "inherit" }}
        >
          {club}
        </span>
      )}
    </div>
  );
}

/** @deprecated Use ClubLogoBox */
export function ClubBadge({
  club,
  colors,
  size = "md",
}: {
  club: string;
  colors: ClubColorSet;
  size?: ClubLogoSize;
}) {
  return <ClubLogoBox club={club} colors={colors} size={size} />;
}
