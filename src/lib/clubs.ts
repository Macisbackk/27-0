import type { CSSProperties } from "react";
import clubsData from "../../data/clubs.json";
import {
  getClubPanelTextStyle,
  getLuminance,
} from "./ui/contrast";



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

}



export const SUPER_LEAGUE_CLUBS: Club[] = clubsData as Club[];



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

  return SUPER_LEAGUE_CLUBS.find(

    (c) =>

      c.name === resolved ||

      c.shortName === resolved ||

      c.id === resolved ||

      c.name.toLowerCase() === resolved.toLowerCase()

  );

}



export type ClubColorSet = {
  primary: string;
  secondary: string;
  accent?: string;
  shortName: string;
};

export function getClubColors(clubName: string): ClubColorSet {
  const club = getClubByName(clubName);

  return club
    ? {
        primary: club.primaryColor,
        secondary: club.secondaryColor,
        accent: club.accentColor,
        shortName: club.shortName,
      }
    : { primary: "#374151", secondary: "#9CA3AF", shortName: "???" };
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



