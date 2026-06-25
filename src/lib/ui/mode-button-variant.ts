import type { ModeVariant } from "../types";

export type ModeButtonVariant = "era" | "current";

/**
 * Maps game mode flags to button variant for Era **toggle tab** only (gold when selected).
 * Current tab and start CTAs use Store `theme` colours.
 */
export function getModeButtonVariant(
  modeVariant: ModeVariant | boolean | undefined
): ModeButtonVariant {
  if (modeVariant === true || modeVariant === "era") return "era";
  return "current";
}

export type ModeStartButtonSize = "home" | "compact";
