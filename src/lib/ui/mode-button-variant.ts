import type { ModeVariant } from "../types";
import type { GameButtonVariant } from "./game-button-variants";

export type ModeButtonVariant = "era" | "current";

/**
 * Maps game mode flags to button variant for Era **toggle tab** only (gold when selected).
 * Current tab uses Store theme when selected.
 */
export function getModeButtonVariant(
  modeVariant: ModeVariant | boolean | undefined
): ModeButtonVariant {
  if (modeVariant === true || modeVariant === "era") return "era";
  return "current";
}

/** Start CTAs: Era = fixed gold; Current = Store theme. */
export function getModeStartButtonVariant(
  eraMode?: boolean | ModeVariant
): GameButtonVariant {
  if (eraMode === true || eraMode === "era") return "era";
  return "theme";
}

export type ModeStartButtonSize = "home" | "compact";
