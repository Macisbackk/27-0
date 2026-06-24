import { getUiThemeById, type UiThemeDefinition } from "../ui-themes";

/** Fixed semantic colours — never change with Store theme. */
const SEMANTIC = {
  success: "#22c55e",
  success2: "#34d399",
  rating: "#22c55e",
  danger: "#ef4444",
  modeCurrent: "#22c55e",
  modeCurrent2: "#34d399",
  modeEra: "#f6c400",
} as const;

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

  /* Store-selected UI theme */
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-secondary", theme.secondary);
  root.style.setProperty("--theme-tertiary", theme.tertiary);
  root.style.setProperty("--theme-primary-rgb", hexToRgbParts(theme.primary));
  root.style.setProperty(
    "--theme-secondary-rgb",
    hexToRgbParts(theme.secondary)
  );
  root.style.setProperty("--theme-tertiary-rgb", hexToRgbParts(theme.tertiary));
  root.style.setProperty("--theme-soft", hexToRgba(theme.primary, 0.12));
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

  /* Legacy aliases */
  root.style.setProperty("--ui-accent-rgb", hexToRgbParts(theme.primary));
  root.style.setProperty("--ui-accent-2-rgb", hexToRgbParts(theme.secondary));
  root.style.setProperty("--ui-accent", theme.primary);
  root.style.setProperty("--ui-accent-2", theme.secondary);
  root.style.setProperty("--ui-accent-soft", hexToRgba(theme.primary, 0.12));
  root.style.setProperty("--ui-accent-text", theme.textOnPrimary);
  root.style.setProperty("--ui-accent-glow", theme.glow);

  /* Mode identity — fixed, never overridden by Store theme */
  root.style.setProperty("--mode-current", SEMANTIC.modeCurrent);
  root.style.setProperty("--mode-current-2", SEMANTIC.modeCurrent2);
  root.style.setProperty("--mode-current-rgb", hexToRgbParts(SEMANTIC.modeCurrent));
  root.style.setProperty(
    "--mode-current-border",
    hexToRgba(SEMANTIC.modeCurrent, 0.75)
  );
  root.style.setProperty(
    "--mode-current-glow",
    hexToRgba(SEMANTIC.modeCurrent, 0.35)
  );
  root.style.setProperty("--mode-era", SEMANTIC.modeEra);
  root.style.setProperty("--mode-era-rgb", hexToRgbParts(SEMANTIC.modeEra));
  root.style.setProperty("--mode-era-glow", hexToRgba(SEMANTIC.modeEra, 0.35));

  /* Semantic — fixed */
  root.style.setProperty("--success", SEMANTIC.success);
  root.style.setProperty("--success-2", SEMANTIC.success2);
  root.style.setProperty("--success-rgb", hexToRgbParts(SEMANTIC.success));
  root.style.setProperty("--rating", SEMANTIC.rating);
  root.style.setProperty("--rating-rgb", hexToRgbParts(SEMANTIC.rating));
  root.style.setProperty("--danger", SEMANTIC.danger);
  root.style.setProperty("--danger-rgb", hexToRgbParts(SEMANTIC.danger));
}

export function applyUiThemeById(themeId: string): void {
  applyUiThemeToDocument(getUiThemeById(themeId));
}
