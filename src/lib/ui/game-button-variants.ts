/**
 * Single source of truth for 27-0 button variants.
 *
 * Do not map generic/primary buttons to Current green.
 * Current green is only for Current Mode actions.
 * Generic buttons must use the selected Store UI theme (`theme` variant).
 */

import { BTN } from "./design-system";

export type GameButtonVariant =
  | "theme"
  | "current"
  | "era"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";

export type GameButtonSize = "sm" | "md" | "lg";

const VARIANT_HOOK: Record<GameButtonVariant, string> = {
  theme: "game-button game-button--theme btn-press-glow",
  current: "game-button game-button--current btn-press-glow",
  era: "game-button game-button--era btn-press-glow-gold",
  secondary: "game-button game-button--secondary btn-press",
  ghost: "game-button game-button--ghost btn-press",
  danger: "game-button game-button--danger btn-press",
  success: "game-button game-button--success btn-press",
};

export const GAME_BUTTON_SIZE_CLASS: Record<GameButtonSize, string> = {
  sm: "game-button--sm",
  md: "game-button--md",
  lg: "game-button--lg",
};

export function getGameButtonClass(
  variant: GameButtonVariant,
  options: { hardMode?: boolean; size?: GameButtonSize } = {}
): string {
  const { hardMode = false, size = "md" } = options;

  if (variant === "current" && hardMode) {
    return `${BTN.currentStartHard} ${GAME_BUTTON_SIZE_CLASS[size]}`;
  }

  if (variant === "current") {
    return `${VARIANT_HOOK.current} ${GAME_BUTTON_SIZE_CLASS[size]}`;
  }

  if (variant === "era") {
    return `${VARIANT_HOOK.era} ${GAME_BUTTON_SIZE_CLASS[size]}`;
  }

  const hook = VARIANT_HOOK[variant];
  const disabled =
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
  return `${hook} ${GAME_BUTTON_SIZE_CLASS[size]} ${disabled}`;
}

/** @deprecated Use getGameButtonClass("theme") — primary must never mean Current green. */
export const THEME_BUTTON_CLASS = getGameButtonClass("theme");
