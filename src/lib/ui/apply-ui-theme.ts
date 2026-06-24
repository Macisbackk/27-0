import { getUiThemeById, type UiThemeDefinition } from "../ui-themes";

function hexToRgbParts(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyUiThemeToDocument(theme: UiThemeDefinition): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.uiTheme = theme.id;
  root.style.setProperty("--ui-accent-rgb", hexToRgbParts(theme.accent));
  root.style.setProperty("--ui-accent-2-rgb", hexToRgbParts(theme.accent2));
  root.style.setProperty("--ui-accent", theme.accent);
  root.style.setProperty("--ui-accent-2", theme.accent2);
  root.style.setProperty("--ui-accent-soft", hexToRgba(theme.accent, 0.12));
  root.style.setProperty("--ui-accent-text", theme.accentText);
  root.style.setProperty("--ui-accent-glow", theme.glow);
}

export function applyUiThemeById(themeId: string): void {
  applyUiThemeToDocument(getUiThemeById(themeId));
}
