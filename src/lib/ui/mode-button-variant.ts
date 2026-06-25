import type { ModeVariant } from "../types";

export type ModeButtonVariant = "era" | "current";

/**
 * Maps game mode flags to button variant for Current/Era **toggle tabs only**.
 * Start/progression CTAs use `theme` (Store colours) via ModeStartLink / GameButton.
 */
export function getModeButtonVariant(
  modeVariant: ModeVariant | boolean | undefined
): ModeButtonVariant {
  if (modeVariant === true || modeVariant === "era") return "era";
  return "current";
}

export type ModeStartButtonSize = "home" | "compact";
