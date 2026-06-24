import { getUiThemeById, type UiThemeDefinition } from "../ui-themes";

const MODE_CURRENT = "#22c55e";
const MODE_CURRENT_2 = "#34d399";
const MODE_ERA = "#f6c400";

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

  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-secondary", theme.secondary);
  root.style.setProperty("--theme-tertiary", theme.tertiary);
  root.style.setProperty("--theme-primary-rgb", hexToRgbParts(theme.primary));
  root.style.setProperty(
    "--theme-secondary-rgb",
    hexToRgbParts(theme.secondary)
  );
  root.style.setProperty("--theme-tertiary-rgb", hexToRgbParts(theme.tertiary));
  root.style.setProperty("--theme-primary-soft", hexToRgba(theme.primary, 0.12));
  root.style.setProperty(
    "--theme-secondary-soft",
    hexToRgba(theme.secondary, 0.14)
  );
  root.style.setProperty("--theme-border", hexToRgba(theme.primary, 0.42));
  root.style.setProperty("--theme-glow", theme.glow);
  root.style.setProperty("--theme-glow-soft", hexToRgba(theme.primary, 0.22));
  root.style.setProperty("--theme-text-on-primary", theme.textOnPrimary);
  root.style.setProperty(
    "--theme-text-on-secondary",
    theme.textOnSecondary
  );

  /* Legacy aliases — Tailwind accent-green maps here */
  root.style.setProperty("--ui-accent-rgb", hexToRgbParts(theme.primary));
  root.style.setProperty("--ui-accent-2-rgb", hexToRgbParts(theme.secondary));
  root.style.setProperty("--ui-accent", theme.primary);
  root.style.setProperty("--ui-accent-2", theme.secondary);
  root.style.setProperty("--ui-accent-soft", hexToRgba(theme.primary, 0.12));
  root.style.setProperty("--ui-accent-text", theme.textOnPrimary);
  root.style.setProperty("--ui-accent-glow", theme.glow);

  /* Mode state colours — never overridden by Store theme */
  root.style.setProperty("--mode-current", MODE_CURRENT);
  root.style.setProperty("--mode-current-2", MODE_CURRENT_2);
  root.style.setProperty("--mode-current-rgb", hexToRgbParts(MODE_CURRENT));
  root.style.setProperty("--mode-current-glow", hexToRgba(MODE_CURRENT, 0.35));
  root.style.setProperty("--mode-era", MODE_ERA);
  root.style.setProperty("--mode-era-rgb", hexToRgbParts(MODE_ERA));
  root.style.setProperty("--mode-era-glow", hexToRgba(MODE_ERA, 0.35));
}

export function applyUiThemeById(themeId: string): void {
  applyUiThemeToDocument(getUiThemeById(themeId));
}
