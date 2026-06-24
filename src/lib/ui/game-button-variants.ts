/**
 * Single source of truth for 27-0 button variants.
 *
 * Generic buttons must use the selected Store UI theme.
 * Do not map primary/theme buttons to Current green.
 * Current green is only for Current Mode actions.
 */

export type GameButtonVariant =
  | "theme"
  | "current"
  | "era"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";

export type GameButtonSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<GameButtonSize, string> = {
  sm: "game-button--sm",
  md: "game-button--md",
  lg: "game-button--lg",
};

const VARIANT_CLASS: Record<GameButtonVariant, string> = {
  theme: "game-button--theme",
  current: "game-button--current",
  era: "game-button--era",
  secondary: "game-button--secondary",
  ghost: "game-button--ghost",
  danger: "game-button--danger",
  success: "game-button--success",
};

const PRESS_CLASS: Record<GameButtonVariant, string> = {
  theme: "btn-press-glow",
  current: "btn-press-glow",
  era: "btn-press-glow-gold",
  secondary: "btn-press",
  ghost: "btn-press",
  danger: "btn-press",
  success: "btn-press",
};

export function getGameButtonClass(
  variant: GameButtonVariant,
  options: { hardMode?: boolean; size?: GameButtonSize } = {}
): string {
  const { hardMode = false, size = "md" } = options;

  if (variant === "current" && hardMode) {
    return [
      "game-button",
      "game-button--current",
      "game-button--current-hard",
      PRESS_CLASS.current,
      SIZE_CLASS[size],
    ].join(" ");
  }

  return [
    "game-button",
    VARIANT_CLASS[variant],
    PRESS_CLASS[variant],
    SIZE_CLASS[size],
  ].join(" ");
}

/** @deprecated Use getGameButtonClass("theme") */
export const THEME_BUTTON_CLASS = getGameButtonClass("theme");
