import type { UiThemeDefinition } from "../ui-themes";
import { resolveThemeGradientColors } from "./theme-accent-colors";

/** Fixed semantic colours — never change with Store theme. */
export const SEMANTIC_COLOURS = {
  success: "#22c55e",
  success2: "#34d399",
  rating: "#22c55e",
  danger: "#ef4444",
  modeCurrent: "#f4f4f6",
  modeCurrent2: "#ffffff",
  modeCurrentText: "#0e0f10",
  modeEra: "#e7d9a8",
  modeEraText: "#0e1400",
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


/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const ch = (i: number) => {
    const c = Number.parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The near-black the pitch buttons, tracks and pills use. */
export const PITCH_DARK = "#0e0f10";

function mixWithWhite(hex: string, t: number): string {
  const n = hex.replace("#", "");
  const out = [0, 2, 4].map((i) => {
    const c = Number.parseInt(n.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * t)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`;
}

/** `a` of colour `x` over colour `y` (both #rrggbb). */
function mixHex(x: string, y: string, a: number): string {
  const px = x.replace("#", "");
  const py = y.replace("#", "");
  const out = [0, 2, 4].map((i) => {
    const cx = Number.parseInt(px.slice(i, i + 2), 16);
    const cy = Number.parseInt(py.slice(i, i + 2), 16);
    return Math.round(cx * a + cy * (1 - a))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`;
}

/**
 * Tokens for the "pitch" surface (the theme-primary hero with mown stripes): the text colour on it
 * (the theme's own text-on-primary when that is AA, else whichever of near-black / white reads
 * better), whether the stripes are dark or light, and the accent as it reads on near-black
 * (lightened until it clears 4.5:1, for small pill text and the button arrow).
 */
export function buildPitchTokens(theme: Pick<UiThemeDefinition, "primary" | "textOnPrimary">): {
  ink: string;
  inkMuted: string;
  markRgb: string;
  primaryOnDark: string;
} {
  let ink = theme.textOnPrimary;
  if (contrast(ink, theme.primary) < 4.5) {
    ink = contrast(PITCH_DARK, theme.primary) >= contrast("#ffffff", theme.primary) ? PITCH_DARK : "#ffffff";
  }
  const markRgb = luminance(ink) < 0.4 ? "0 0 0" : "255 255 255";
  let primaryOnDark = theme.primary;
  for (let t = 0.1; contrast(primaryOnDark, PITCH_DARK) < 4.5 && t <= 1; t += 0.1) {
    primaryOnDark = mixWithWhite(theme.primary, t);
  }
  // Secondary text straight on the pitch: the ink pulled ~30% toward the pitch colour, but never
  // below AA (light inks on dark primaries need more of the ink to stay readable).
  let inkMuted = ink;
  for (let a = 0.7; a <= 1.0001; a += 0.05) {
    const mixed = mixHex(ink, theme.primary, a);
    if (contrast(mixed, theme.primary) >= 4.5) {
      inkMuted = mixed;
      break;
    }
  }
  return { ink, inkMuted, markRgb, primaryOnDark };
}

/** All CSS custom properties for a Store UI theme + fixed mode/semantic tokens. */
export function buildThemeCssVars(theme: UiThemeDefinition): Record<string, string> {
  const gradient = resolveThemeGradientColors({
    primary: theme.primary,
    secondary: theme.secondary,
    tertiary: theme.tertiary,
  });

  const pitch = buildPitchTokens(theme);

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
    "--theme-button-primary-text": pitch.ink,
    /* Pitch surface (the home Classic card's look, shared site-wide: see src/styles/pitch.css). */
    "--pitch-ink": pitch.ink,
    "--pitch-ink-muted": pitch.inkMuted,
    "--pitch-mark-rgb": pitch.markRgb,
    "--theme-primary-on-dark": pitch.primaryOnDark,
    "--theme-button-primary-border": hexToRgba(theme.tertiary, 0.55),
    "--theme-button-primary-hover-bg": theme.secondary,
    "--theme-button-primary-active-bg": theme.tertiary,
    "--theme-button-secondary-bg": "rgba(35, 37, 39, 0.96)",
    "--theme-button-secondary-text": "#e5e7eb",
    "--theme-button-secondary-border": hexToRgba(theme.tertiary, 0.4),
    "--theme-button-secondary-hover-bg": hexToRgba(theme.primary, 0.1),
    "--theme-focus-ring": hexToRgba(theme.primary, 0.45),
    "--theme-page-background": "transparent",
    "--theme-panel-background": "rgba(25, 26, 28, 0.97)",
    "--theme-card-background": "rgba(25, 26, 28, 0.97)",
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
