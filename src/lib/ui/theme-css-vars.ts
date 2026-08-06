import type { UiThemeDefinition } from "../ui-themes";
import { resolveThemeGradientColors } from "./theme-accent-colors";

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
  const gradient = resolveThemeGradientColors({
    primary: theme.primary,
    secondary: theme.secondary,
    tertiary: theme.tertiary,
  });

  return {
    "--theme-primary": theme.primary,
    "--theme-secondary": theme.secondary,
    "--theme-tertiary": theme.tertiary,
    "--theme-gradient-from": gradient.gradientFrom,
    "--theme-gradient-to": gradient.gradientTo,
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
    /* Generic UI button tokens — Store themes must drive these. */
    "--theme-button-primary-bg": theme.primary,
    "--theme-button-primary-text": theme.textOnPrimary,
    "--theme-button-primary-border": hexToRgba(theme.tertiary, 0.55),
    "--theme-button-primary-hover-bg": theme.secondary,
    "--theme-button-primary-active-bg": theme.tertiary,
    "--theme-button-secondary-bg": "rgba(7, 12, 11, 0.94)",
    "--theme-button-secondary-text": "#e5e7eb",
    "--theme-button-secondary-border": hexToRgba(theme.tertiary, 0.4),
    "--theme-button-secondary-hover-bg": hexToRgba(theme.primary, 0.1),
    "--theme-focus-ring": hexToRgba(theme.primary, 0.45),
    "--theme-page-background": "transparent",
    "--theme-panel-background": "rgba(8, 12, 13, 0.96)",
    "--theme-card-background": "rgba(8, 12, 13, 0.96)",
    "--theme-text": "#f3f4f6",
    "--theme-muted-text": "#9ca3af",
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
  const gradient = resolveThemeGradientColors({
    primary: theme.primary,
    secondary: theme.secondary,
    tertiary: theme.tertiary,
  });
  const nextGlow = gradient.logoGlow ? "true" : "false";
  const vars = buildThemeCssVars(theme);

  let changed = root.dataset.uiTheme !== theme.id;
  if (root.dataset.themeLogoGlow !== nextGlow) changed = true;

  for (const [key, value] of Object.entries(vars)) {
    if (root.style.getPropertyValue(key).trim() !== value) {
      changed = true;
      break;
    }
  }

  // Avoid site-wide repaints when bootstrap/cloud re-apply the same theme.
  if (!changed) return;

  root.dataset.uiTheme = theme.id;
  root.dataset.themeLogoGlow = nextGlow;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
