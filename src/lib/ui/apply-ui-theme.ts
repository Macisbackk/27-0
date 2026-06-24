import { getUiThemeById, type UiThemeDefinition } from "../ui-themes";

export function applyUiThemeToDocument(theme: UiThemeDefinition): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--ui-accent", theme.accent);
  root.style.setProperty("--ui-accent-2", theme.accent2);
  root.style.setProperty("--ui-accent-text", theme.accentText);
  root.style.setProperty("--ui-accent-glow", theme.glow);
}

export function applyUiThemeById(themeId: string): void {
  applyUiThemeToDocument(getUiThemeById(themeId));
}
