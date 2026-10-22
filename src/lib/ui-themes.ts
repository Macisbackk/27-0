import {
  CURRENT_PLAYABLE_CLUBS,
  ERA_HISTORIC_ONLY_CLUBS,
} from "./clubs/super-league-display";
import { isBlackLike } from "./ui/theme-accent-colors";
import {
  getTeamUiThemeByClubName,
  listTeamUiThemes,
  slugifyTeamThemeId,
  type TeamUiThemeColors,
} from "./ui/team-ui-themes";

export const DEFAULT_UI_THEME_ID = "default";
export const UI_THEME_PURCHASE_PRICE = 2_500_000;

export interface UiThemeDefinition {
  id: string;
  label: string;
  clubName?: string;
  primary: string;
  secondary: string;
  tertiary: string;
  textOnPrimary: string;
  textOnSecondary: string;
  /** @deprecated Use primary — kept for gradual migration */
  accent: string;
  /** @deprecated Use secondary */
  accent2: string;
  /** @deprecated Use tertiary */
  accent3: string;
  accentText: string;
  glow: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fromTeamColors(team: TeamUiThemeColors): UiThemeDefinition {
  return {
    id: team.id,
    label: team.name,
    clubName: team.name,
    primary: team.primary,
    secondary: team.secondary,
    tertiary: team.tertiary,
    textOnPrimary: team.textOnPrimary,
    textOnSecondary: team.textOnSecondary,
    accent: team.primary,
    accent2: team.secondary,
    accent3: team.tertiary,
    accentText: team.textOnPrimary,
    glow: hexToRgba(team.primary, 0.35),
  };
}

export const DEFAULT_UI_THEME: UiThemeDefinition = {
  id: DEFAULT_UI_THEME_ID,
  label: "Default",
  // Matchnight scoreboard amber.
  primary: "#ffb21e",
  secondary: "#ffc95a",
  tertiary: "#f09a00",
  textOnPrimary: "#1c1300",
  textOnSecondary: "#1c1300",
  accent: "#ffb21e",
  accent2: "#ffc95a",
  accent3: "#f09a00",
  accentText: "#1c1300",
  glow: "rgba(255, 178, 30, 0.35)",
};

const CLUB_THEME_NAMES = [
  ...CURRENT_PLAYABLE_CLUBS,
  ...ERA_HISTORIC_ONLY_CLUBS,
] as const;

function clubTheme(clubName: string): UiThemeDefinition {
  const team = getTeamUiThemeByClubName(clubName);
  if (!team) {
    throw new Error(`Missing Store UI theme config for club: ${clubName}`);
  }
  return fromTeamColors(team);
}

export const UI_THEMES: UiThemeDefinition[] = [
  DEFAULT_UI_THEME,
  ...CLUB_THEME_NAMES.map(clubTheme),
];

export function getUiThemeById(id: string): UiThemeDefinition {
  if (id === DEFAULT_UI_THEME_ID) return DEFAULT_UI_THEME;
  const team = listTeamUiThemes().find((t) => t.id === id);
  if (team) return fromTeamColors(team);
  return DEFAULT_UI_THEME;
}

/** True only for ids that resolve to a real theme (getUiThemeById falls back to the default). */
export function isKnownUiThemeId(id: string): boolean {
  return id === DEFAULT_UI_THEME_ID || listTeamUiThemes().some((t) => t.id === id);
}

export function getUiThemeByClubName(clubName: string): UiThemeDefinition | null {
  const team = getTeamUiThemeByClubName(clubName);
  return team ? fromTeamColors(team) : null;
}

export function isDefaultUiTheme(id: string): boolean {
  return id === DEFAULT_UI_THEME_ID;
}

/** Default first, then unlocked club themes, then locked (original order within each group). */
export function sortUiThemesForStore(
  themes: UiThemeDefinition[],
  unlockedThemeIds: string[]
): UiThemeDefinition[] {
  const unlocked = new Set(unlockedThemeIds);
  const defaultTheme =
    themes.find((theme) => theme.id === DEFAULT_UI_THEME_ID) ?? DEFAULT_UI_THEME;
  const others = themes.filter((theme) => theme.id !== DEFAULT_UI_THEME_ID);
  const purchased = others.filter((theme) => unlocked.has(theme.id));
  const locked = others.filter((theme) => !unlocked.has(theme.id));
  return [defaultTheme, ...purchased, ...locked];
}

export function assertNoBlackPrimaryUiThemes(): void {
  for (const theme of UI_THEMES) {
    if (theme.id === DEFAULT_UI_THEME_ID) continue;
    if (isBlackLike(theme.primary)) {
      throw new Error(
        `UI theme "${theme.label}" uses black-like primary: ${theme.primary}`
      );
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  assertNoBlackPrimaryUiThemes();
}

export { slugifyTeamThemeId };
