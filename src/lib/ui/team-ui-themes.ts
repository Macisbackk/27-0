import { isBlackLike } from "./theme-accent-colors";

/** Store UI palette for a club: two main kit colours plus a third trim colour that tells apart clubs sharing the same two. */
export interface TeamUiThemeColors {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  tertiary: string;
  textOnPrimary: string;
  textOnSecondary: string;
}

export const TEAM_UI_THEMES: Record<string, TeamUiThemeColors> = {
  "bradford-bulls": {
    id: "bradford-bulls",
    name: "Bradford Bulls",
    primary: "#E31B23",
    secondary: "#111111",
    tertiary: "#F2E6C9",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#FFFFFF",
  },
  "castleford-tigers": {
    id: "castleford-tigers",
    name: "Castleford Tigers",
    primary: "#F6C400",
    secondary: "#111111",
    tertiary: "#FFFFFF",
    textOnPrimary: "#111111",
    textOnSecondary: "#FFFFFF",
  },
  "catalans-dragons": {
    id: "catalans-dragons",
    name: "Catalans Dragons",
    primary: "#F58220",
    secondary: "#B5121B",
    tertiary: "#F2E6C9",
    textOnPrimary: "#111111",
    textOnSecondary: "#FFFFFF",
  },
  "huddersfield-giants": {
    id: "huddersfield-giants",
    name: "Huddersfield Giants",
    primary: "#F6C400",
    secondary: "#7A1230",
    tertiary: "#FFFFFF",
    textOnPrimary: "#111111",
    textOnSecondary: "#FFFFFF",
  },
  "hull-fc": {
    id: "hull-fc",
    name: "Hull FC",
    primary: "#F2F2F2",
    secondary: "#111111",
    tertiary: "#9CA3AF",
    textOnPrimary: "#111111",
    textOnSecondary: "#FFFFFF",
  },
  "hull-kr": {
    id: "hull-kr",
    name: "Hull KR",
    primary: "#E31B23",
    secondary: "#FFFFFF",
    tertiary: "#C9A227",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "leeds-rhinos": {
    id: "leeds-rhinos",
    name: "Leeds Rhinos",
    primary: "#0057B8",
    secondary: "#F6C400",
    tertiary: "#FFFFFF",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "leigh-leopards": {
    id: "leigh-leopards",
    name: "Leigh Leopards",
    primary: "#E31B23",
    secondary: "#111111",
    tertiary: "#FDB913",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#FFFFFF",
  },
  "st-helens": {
    id: "st-helens",
    name: "St Helens",
    primary: "#E31B23",
    secondary: "#FFFFFF",
    tertiary: "#1F2A44",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "toulouse-olympique": {
    id: "toulouse-olympique",
    name: "Toulouse Olympique",
    primary: "#0057B8",
    secondary: "#FFFFFF",
    tertiary: "#C1272D",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "wakefield-trinity": {
    id: "wakefield-trinity",
    name: "Wakefield Trinity",
    primary: "#0057B8",
    secondary: "#D71920",
    tertiary: "#FFFFFF",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#FFFFFF",
  },
  "warrington-wolves": {
    id: "warrington-wolves",
    name: "Warrington Wolves",
    primary: "#0057B8",
    secondary: "#F6C400",
    tertiary: "#F2E6C9",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "wigan-warriors": {
    id: "wigan-warriors",
    name: "Wigan Warriors",
    primary: "#8B0015",
    secondary: "#FFFFFF",
    tertiary: "#F2E6C9",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "york-knights": {
    id: "york-knights",
    name: "York Knights",
    primary: "#F6C400",
    secondary: "#FFFFFF",
    tertiary: "#1E4D9B",
    textOnPrimary: "#111111",
    textOnSecondary: "#111111",
  },
  "london-broncos": {
    id: "london-broncos",
    name: "London Broncos",
    primary: "#D71920",
    secondary: "#0057B8",
    tertiary: "#FFFFFF",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#FFFFFF",
  },
  "salford-red-devils": {
    id: "salford-red-devils",
    name: "Salford Red Devils",
    primary: "#D71920",
    secondary: "#FFFFFF",
    tertiary: "#FDB913",
    textOnPrimary: "#FFFFFF",
    textOnSecondary: "#111111",
  },
  "widnes-vikings": {
    id: "widnes-vikings",
    name: "Widnes Vikings",
    primary: "#F2F2F2",
    secondary: "#111111",
    tertiary: "#C8102E",
    textOnPrimary: "#111111",
    textOnSecondary: "#FFFFFF",
  },
};

export function slugifyTeamThemeId(clubName: string): string {
  return clubName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTeamUiThemeByClubName(clubName: string): TeamUiThemeColors | null {
  const id = slugifyTeamThemeId(clubName);
  return TEAM_UI_THEMES[id] ?? null;
}

export function listTeamUiThemes(): TeamUiThemeColors[] {
  return Object.values(TEAM_UI_THEMES);
}

/** Dev guard — no store theme may use black as primary. */
export function assertTeamUiThemesValid(): void {
  for (const theme of listTeamUiThemes()) {
    if (isBlackLike(theme.primary)) {
      throw new Error(
        `Team UI theme "${theme.name}" has black-like primary: ${theme.primary}`
      );
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  assertTeamUiThemesValid();
}
