import type { UiThemeDefinition } from "../ui-themes";

/** Fixed semantic colours — never change with Store theme. */
export const SEMANTIC_COLOURS = {
  success: "#22c55e",
  success2: "#34d399",
  rating: "#22c55e",
  danger: "#ef4444",
  modeCurrent: "#22c55e",
  modeCurrent2: "#34d399",
  modeCurrentText: "#07130a",
  modeEra: "#f6c400",
  modeEraText: "#0a0f0d",
} as const;

export function hexToRgbParts(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** All CSS custom properties for a Store UI theme + fixed mode/semantic tokens. */
export function buildThemeCssVars(theme: UiThemeDefinition): Record<string, string> {
  return {
    "--theme-primary": theme.primary,
    "--theme-secondary": theme.secondary,
    "--theme-tertiary": theme.tertiary,
    "--theme-primary-rgb": hexToRgbParts(theme.primary),
    "--theme-secondary-rgb": hexToRgbParts(theme.secondary),
    "--theme-tertiary-rgb": hexToRgbParts(theme.tertiary),
    "--theme-soft": hexToRgba(theme.primary, 0.12),
    "--theme-primary-soft": hexToRgba(theme.primary, 0.12),
    "--theme-secondary-soft": hexToRgba(theme.secondary, 0.14),
    "--theme-tertiary-soft": hexToRgba(theme.tertiary, 0.18),
    "--theme-border": hexToRgba(theme.tertiary, 0.55),
    "--theme-tertiary-border": hexToRgba(theme.tertiary, 0.65),
    "--theme-glow": theme.glow,
    "--theme-glow-soft": hexToRgba(theme.primary, 0.22),
    "--theme-text-on-primary": theme.textOnPrimary,
    "--theme-text-on-secondary": theme.textOnSecondary,
    "--ui-accent-rgb": hexToRgbParts(theme.primary),
    "--ui-accent-2-rgb": hexToRgbParts(theme.secondary),
    "--ui-accent": theme.primary,
    "--ui-accent-2": theme.secondary,
    "--ui-accent-soft": hexToRgba(theme.primary, 0.12),
    "--ui-accent-text": theme.textOnPrimary,
    "--ui-accent-glow": theme.glow,
    "--mode-current": SEMANTIC_COLOURS.modeCurrent,
    "--mode-current-2": SEMANTIC_COLOURS.modeCurrent2,
    "--mode-current-rgb": hexToRgbParts(SEMANTIC_COLOURS.modeCurrent),
    "--mode-current-border": hexToRgba(SEMANTIC_COLOURS.modeCurrent, 0.75),
    "--mode-current-glow": hexToRgba(SEMANTIC_COLOURS.modeCurrent, 0.35),
    "--mode-current-text": SEMANTIC_COLOURS.modeCurrentText,
    "--mode-era": SEMANTIC_COLOURS.modeEra,
    "--mode-era-rgb": hexToRgbParts(SEMANTIC_COLOURS.modeEra),
    "--mode-era-border": hexToRgba(SEMANTIC_COLOURS.modeEra, 0.75),
    "--mode-era-glow": hexToRgba(SEMANTIC_COLOURS.modeEra, 0.35),
    "--mode-era-text": SEMANTIC_COLOURS.modeEraText,
    "--success": SEMANTIC_COLOURS.success,
    "--success-2": SEMANTIC_COLOURS.success2,
    "--success-rgb": hexToRgbParts(SEMANTIC_COLOURS.success),
    "--rating": SEMANTIC_COLOURS.rating,
    "--rating-rgb": hexToRgbParts(SEMANTIC_COLOURS.rating),
    "--danger": SEMANTIC_COLOURS.danger,
    "--danger-rgb": hexToRgbParts(SEMANTIC_COLOURS.danger),
  };
}

export function applyThemeCssVarsToRoot(
  theme: UiThemeDefinition,
  root: HTMLElement = document.documentElement
): void {
  root.dataset.uiTheme = theme.id;
  const vars = buildThemeCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
