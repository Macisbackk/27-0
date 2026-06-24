import { getUiThemeById, type UiThemeDefinition } from "../ui-themes";
import { STORAGE_KEYS } from "../storage/keys";
import {
  applyThemeCssVarsToRoot,
  buildThemeCssVars,
} from "./theme-css-vars";

export function applyUiThemeToDocument(theme: UiThemeDefinition): void {
  if (typeof document === "undefined") return;

  applyThemeCssVarsToRoot(theme);

  try {
    localStorage.setItem(
      STORAGE_KEYS.uiThemeCssCache,
      JSON.stringify({
        themeId: theme.id,
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
