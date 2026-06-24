import { getClubColors } from "./clubs";
import {
  CURRENT_PLAYABLE_CLUBS,
  ERA_HISTORIC_ONLY_CLUBS,
} from "./clubs/super-league-display";

export const DEFAULT_UI_THEME_ID = "default";
export const UI_THEME_PURCHASE_PRICE = 2_500_000;

export interface UiThemeDefinition {
  id: string;
  label: string;
  clubName?: string;
  accent: string;
  accent2: string;
  accentText: string;
  glow: string;
}

function clubTheme(clubName: string): UiThemeDefinition {
  const colors = getClubColors(clubName);
  const accent = colors.primary;
  const accent2 = colors.secondary;
  return {
    id: slugifyThemeId(clubName),
    label: clubName,
    clubName,
    accent,
    accent2,
    accentText: pickReadableText(accent),
    glow: hexToRgba(accent, 0.35),
  };
}

function slugifyThemeId(clubName: string): string {
  return clubName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickReadableText(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0a0f0d" : "#ffffff";
}

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const DEFAULT_UI_THEME: UiThemeDefinition = {
  id: DEFAULT_UI_THEME_ID,
  label: "Default",
  accent: "#22c55e",
  accent2: "#34d399",
  accentText: "#0a0f0d",
  glow: "rgba(34, 197, 94, 0.35)",
};

const CLUB_THEME_NAMES = [
  ...CURRENT_PLAYABLE_CLUBS,
  ...ERA_HISTORIC_ONLY_CLUBS,
] as const;

export const UI_THEMES: UiThemeDefinition[] = [
  DEFAULT_UI_THEME,
  ...CLUB_THEME_NAMES.map(clubTheme),
];

export function getUiThemeById(id: string): UiThemeDefinition {
  return UI_THEMES.find((theme) => theme.id === id) ?? DEFAULT_UI_THEME;
}

export function isDefaultUiTheme(id: string): boolean {
  return id === DEFAULT_UI_THEME_ID;
}
