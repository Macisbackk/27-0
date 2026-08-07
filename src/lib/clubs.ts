import type { CSSProperties } from "react";
import clubsData from "../../data/clubs.json";
import { getAllNrlClubsAsClub, getNrlClubByName, nrlClubToClub } from "./nrl/nrlClubs";
import {
  getChampionshipClubByName,
  getChampionshipOnlyClubsAsClub,
} from "./clubs/championship-clubs";
import {
  getClubPanelTextStyle,
  getClubPillBackground,
  getLuminance,
} from "./ui/contrast";
import { isBlackLike, UI_BLACK_TRIM, UI_THEME_WHITE_SOFT } from "./ui/theme-accent-colors";



export interface Club {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  active?: boolean;
  isCurrentSuperLeague?: boolean;
  playable?: boolean;
  /** Present for NRL club records; Super League clubs omit or use super_league. */
  league?: "super_league" | "nrl";
  /** 2026 Championship metadata (lower-league expansion). */
  abbreviation?: string;
  country?: string;
  competitionTier2026?: "championship";
  previousTier2025?: "championship" | "league-one";
  textColour?: string;
  challengeCupEligible?: boolean;
  managerSelectable?: boolean;
  generatedSquad?: boolean;
  baseStrength?: number;
}

export const SUPER_LEAGUE_CLUBS: Club[] = (clubsData as Club[]).map((c) => ({
  ...c,
  league: c.league ?? "super_league",
}));



const CLUB_ALIASES: Record<string, string> = {

  Salford: "Salford Red Devils",

  "Salford City Reds": "Salford Red Devils",

  "Salford Reds": "Salford Red Devils",

  Widnes: "Widnes Vikings",

  Halifax: "Halifax Panthers",

  York: "York Knights",
  "York City Knights": "York Knights",

  Toulouse: "Toulouse Olympique",

  Crusaders: "Crusaders RL",

  PSG: "Paris Saint-Germain RL",

  "Paris Saint-Germain": "Paris Saint-Germain RL",

  Gateshead: "Gateshead Thunder",

  Oldham: "Oldham RLFC",

  Sheffield: "Sheffield Eagles",

  Leigh: "Leigh Leopards",

};



function stripEraYearSuffix(name: string): string {
  const historic = name.match(/^(.+?) '\d{2}$/);
  if (historic) return historic[1];
  const modern = name.match(/^(.+?) 26$/);
  if (modern) return modern[1];
  return name;
}

export function getClubByName(name: string): Club | undefined {
  const resolved = stripEraYearSuffix(CLUB_ALIASES[name] ?? name);

  const championship = getChampionshipClubByName(resolved);
  if (championship) {
    return championship;
  }

  const sl = SUPER_LEAGUE_CLUBS.find(
    (c) =>
      c.name === resolved ||
      c.shortName === resolved ||
      c.id === resolved ||
      c.name.toLowerCase() === resolved.toLowerCase()
  );
  if (sl) return sl;

  const nrl = getNrlClubByName(resolved);
  return nrl ? nrlClubToClub(nrl) : undefined;
}

/** All known clubs across Super League + Championship + NRL (NRL remains non-playable). */
export function getAllClubs(): Club[] {
  const champOnly = getChampionshipOnlyClubsAsClub();
  const seen = new Set(SUPER_LEAGUE_CLUBS.map((c) => c.id));
  const merged = [...SUPER_LEAGUE_CLUBS];
  for (const club of champOnly) {
    if (!seen.has(club.id)) {
      seen.add(club.id);
      merged.push(club);
    }
  }
  return [...merged, ...getAllNrlClubsAsClub()];
}



export type ClubColorSet = {
  primary: string;
  secondary: string;
  accent?: string;
  shortName: string;
};

/**
 * Map kit colours to UI-safe pair — chromatic colour is always `primary`.
 * Black is never used as the lead accent (headers, indicators, stripes).
 */
export function resolveClubUiColors(
  primary: string,
  secondary: string,
  accent?: string
): { primary: string; secondary: string } {
  const kit = [primary, secondary, accent].filter((c): c is string => Boolean(c));
  const chromatic = kit.filter((c) => !isBlackLike(c));

  if (chromatic.length === 0) {
    return { primary: "#374151", secondary: "#9CA3AF" };
  }

  let uiPrimary: string;
  if (!isBlackLike(primary)) {
    uiPrimary = primary;
  } else if (!isBlackLike(secondary)) {
    uiPrimary = secondary;
  } else if (accent && !isBlackLike(accent)) {
    uiPrimary = accent;
  } else {
    uiPrimary = chromatic[0]!;
  }

  let uiSecondary: string | undefined;
  for (const c of [secondary, primary, accent]) {
    if (c && !isBlackLike(c) && c !== uiPrimary) {
      uiSecondary = c;
      break;
    }
  }

  if (!uiSecondary) {
    uiSecondary = kit.some(isBlackLike)
      ? UI_BLACK_TRIM
      : chromatic.find((c) => c !== uiPrimary) ?? "#9CA3AF";
  }

  return { primary: uiPrimary, secondary: uiSecondary };
}

export function getClubColors(clubName: string): ClubColorSet {
  const club = getClubByName(clubName);

  if (!club) {
    return { primary: "#374151", secondary: "#9CA3AF", shortName: "???" };
  }

  const ui = resolveClubUiColors(
    club.primaryColor,
    club.secondaryColor,
    club.accentColor
  );
  return {
    primary: ui.primary,
    secondary: ui.secondary,
    accent: club.accentColor,
    shortName: club.shortName,
  };
}

/** Single-colour club marker for tables, borders, and nav accents. */
export function getClubIndicatorColor(clubName: string): string {
  const club = getClubByName(clubName);
  if (!club) {
    return "#374151";
  }

  const indicator = getClubPillBackground(
    club.primaryColor,
    club.secondaryColor,
    club.accentColor
  );

  // Near-black indicators vanish on dark UI (e.g. Hull FC black kit).
  if (getLuminance(indicator) < 0.1) {
    const chromatic = [club.primaryColor, club.secondaryColor, club.accentColor]
      .filter((c): c is string => Boolean(c))
      .filter((c) => !isBlackLike(c));
    const onDark = chromatic.find(
      (c) => getLuminance(c) >= 0.15 && getLuminance(c) < 0.85
    );
    if (onDark) return onDark;
    return UI_THEME_WHITE_SOFT;
  }

  return indicator;
}

/**
 * Accent colour for Match Stats / event panels.
 * Prefer club secondary so scoring cards stay neutral (no Store theme strip).
 */
export function getClubEventPanelAccent(
  clubId: string,
  tone: "primary" | "secondary" = "secondary"
): string {
  const colors = getClubColors(clubId);
  return tone === "primary" ? colors.primary : colors.secondary;
}

/** Shared two-tone club theme — single source for all club UI. */
export interface ClubTheme {
  colors: ClubColorSet;
  cardBorder: string;
  cardBackground: string;
  headerBackground: string;
  headerStripe: string;
  logoBorder: string;
  logoPrimaryPanel: string;
  logoSecondaryPanel: string;
}

export function getClubTheme(clubName: string): ClubTheme {
  const colors = getClubColors(clubName);
  return {
    colors,
    cardBorder: colors.secondary,
    cardBackground: "rgba(15, 24, 20, 0.9)",
    headerBackground: colors.primary,
    headerStripe: colors.secondary,
    logoBorder: colors.secondary,
    logoPrimaryPanel: colors.primary,
    logoSecondaryPanel: colors.secondary,
  };
}

/**
 * Player/team identity colours for cards — NEVER Store UI theme.
 * Use for Showcase, recruitment, pitch tiles, and other player surfaces.
 */
export type PlayerCardColours = {
  colors: ClubColorSet;
  /** Chromatic accent safe on dark UI */
  accent: string;
  /** Solid border colour (club secondary / kit edge) */
  border: string;
  /** Soft wash for selected/expanded states */
  wash: string;
  /** Inline styles for card chrome */
  style: CSSProperties;
  expandedStyle: CSSProperties;
};

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6 && raw.length !== 3) {
    return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
  }
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getPlayerCardColours(clubName: string): PlayerCardColours {
  const theme = getClubTheme(clubName);
  const colors = theme.colors;
  const accent = getClubIndicatorColor(clubName);
  const border = accent;
  return {
    colors,
    accent,
    border,
    wash: withAlpha(accent, 0.08),
    style: {
      borderColor: withAlpha(border, 0.45),
    },
    expandedStyle: {
      borderColor: withAlpha(border, 0.65),
      backgroundColor: withAlpha(accent, 0.06),
      boxShadow: `inset 0 0 0 1px ${withAlpha(border, 0.25)}`,
    },
  };
}

/** Alias — preferred name for player/team card kit colours. */
export function getClubColoursForCard(clubName: string): PlayerCardColours {
  return getPlayerCardColours(clubName);
}

export const CLUB_CHOICE_CARD_CLASS = "rounded-lg overflow-hidden";

export function getClubChoiceCardStyle(clubName: string): CSSProperties {
  const theme = getClubTheme(clubName);
  return {
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBackground,
  };
}

export function getClubHeaderBarStyle(clubName: string): CSSProperties {
  const theme = getClubTheme(clubName);
  const text = getClubPanelTextStyle(theme.headerBackground);
  return {
    backgroundColor: theme.headerBackground,
    borderBottom: `4px solid ${theme.headerStripe}`,
    color: text.color,
    textShadow: text.textShadow,
  };
}

function getClubStripBackground(clubName: string): string {
  const colors = getClubColors(clubName);
  if (getLuminance(colors.primary) > 0.85) {
    return colors.secondary;
  }
  return colors.primary;
}

export function getClubIdentityStripStyle(clubName: string): CSSProperties {
  const theme = getClubTheme(clubName);
  const background = getClubStripBackground(clubName);
  const text = getClubPanelTextStyle(background);
  return {
    backgroundColor: background,
    borderBottom: `2px solid ${theme.headerStripe}`,
    color: text.color,
    textShadow: text.textShadow,
  };
}

/** Whether club header text should use the dark outline utility class. */
export function clubHeaderUsesStroke(clubName: string): boolean {
  const theme = getClubTheme(clubName);
  return getClubPanelTextStyle(theme.headerBackground).useStroke;
}

export function getClubLogoBoxStyle(clubName: string): CSSProperties {
  const theme = getClubTheme(clubName);
  return { borderColor: theme.logoBorder };
}

export {
  isPlayableClub,

  getPlayableClubNames,

  isActiveSuperLeagueClub,

  getActiveSuperLeagueClubNames,

  resolveDisplayClub,

} from "./clubs/super-league-display";



