import { isBlackLike } from "./ui/theme-accent-colors";

export const DEFAULT_UI_THEME_ID = "default";
export const UI_THEME_PURCHASE_PRICE = 2_500_000;

export interface UiThemeDefinition {
  id: string;
  label: string;
  /** One line on the look. */
  blurb?: string;
  /** Legacy club themes (removed in v1.11) carried the club name; kept optional for old saves. */
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

export const DEFAULT_UI_THEME: UiThemeDefinition = {
  id: DEFAULT_UI_THEME_ID,
  label: "Floodlit",
  blurb: "Lime under the lights. The 27-0 look.",
  // Floodlit lime with near-black text (a yellow-green, not 38-0's mint).
  primary: "#b6f23d",
  secondary: "#c6f56a",
  tertiary: "#9ad61e",
  textOnPrimary: "#0e1400",
  textOnSecondary: "#0e1400",
  accent: "#b6f23d",
  accent2: "#c6f56a",
  accent3: "#9ad61e",
  accentText: "#0e1400",
  glow: "rgba(182, 242, 61, 0.35)",
};

/** A style theme: a three-colour accent set, named after something from the game. */
function style(
  id: string,
  label: string,
  blurb: string,
  primary: string,
  secondary: string,
  tertiary: string,
  textOnPrimary: string,
  textOnSecondary = textOnPrimary
): UiThemeDefinition {
  return {
    id,
    label,
    blurb,
    primary,
    secondary,
    tertiary,
    textOnPrimary,
    textOnSecondary,
    accent: primary,
    accent2: secondary,
    accent3: tertiary,
    accentText: textOnPrimary,
    glow: hexToRgba(primary, 0.35),
  };
}

/**
 * The Store's nine style themes (club-colour themes were retired in v1.11: too many looked alike).
 * Each is named for something you'd see on a matchday, with its own three-colour accent set.
 */
export const STYLE_UI_THEMES: UiThemeDefinition[] = [
  style("turf", "Turf", "Fresh-cut pitch green with a chalk-white line.", "#2fbf6b", "#5ad48c", "#f3f3ee", "#06130b"),
  style("chalk", "Chalk", "Touchline white on the dark. Clean and sharp.", "#f3f3ee", "#d9d9d1", "#9aa0a6", "#0e0f10"),
  style("amber", "Scoreboard amber", "Old-school amber bulbs on the big screen.", "#f5b82e", "#ffd166", "#c98a00", "#1a1200"),
  style("matchball", "Matchball", "Steeden gold and leather tan.", "#e0a84a", "#f0c87a", "#8a5a1e", "#1a1000"),
  style("cherry", "Cherry", "Deep cherry with a cream trim.", "#c8102e", "#e4455c", "#f2e6c9", "#ffffff"),
  style("sky", "Sky", "Sky blue with a bright white edge.", "#38bdf8", "#7dd3fc", "#0369a1", "#06202c"),
  style("neon", "Neon", "Electric magenta. Loud as a Magic Weekend.", "#ff2d95", "#ff6fb5", "#8a1356", "#ffffff"),
  style("frost", "Frost", "Icy teal for the winter fixtures.", "#5eead4", "#99f6e4", "#0f766e", "#042f2e"),
  style("ember", "Ember", "Burnt orange, like the floodlights at dusk.", "#f97316", "#fb923c", "#9a3412", "#1c0a00"),
];

export const UI_THEMES: UiThemeDefinition[] = [DEFAULT_UI_THEME, ...STYLE_UI_THEMES];

const THEME_BY_ID = new Map(UI_THEMES.map((t) => [t.id, t]));

export function getUiThemeById(id: string): UiThemeDefinition {
  return THEME_BY_ID.get(id) ?? DEFAULT_UI_THEME;
}

/** True only for ids that resolve to a real theme (getUiThemeById falls back to the default). */
export function isKnownUiThemeId(id: string): boolean {
  return THEME_BY_ID.has(id);
}

/** Club themes were retired in v1.11; nothing maps to a club any more. */
export function getUiThemeByClubName(_clubName: string): UiThemeDefinition | null {
  return null;
}

export function isDefaultUiTheme(id: string): boolean {
  return id === DEFAULT_UI_THEME_ID;
}

/** Floodlit first, then owned themes, then the rest (original order within each group). */
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

