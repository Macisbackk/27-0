import { getUiThemeById, type UiThemeDefinition } from "../ui-themes";
import { STORAGE_KEYS } from "../storage/keys";
import { resolveThemeGradientColors } from "./theme-accent-colors";
import {
  applyThemeCssVarsToRoot,
  buildThemeCssVars,
} from "./theme-css-vars";

export function applyUiThemeToDocument(theme: UiThemeDefinition): void {
  if (typeof document === "undefined") return;

  applyThemeCssVarsToRoot(theme);

  try {
    const gradient = resolveThemeGradientColors({
      primary: theme.primary,
      secondary: theme.secondary,
      tertiary: theme.tertiary,
    });
    localStorage.setItem(
      STORAGE_KEYS.uiThemeCssCache,
      JSON.stringify({
        themeId: theme.id,
        logoGlow: gradient.logoGlow,
        vars: buildThemeCssVars(theme),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyUiThemeById(themeId: string): void {
  applyUiThemeToDocument(getUiThemeById(themeId));
}
