import type { ModeVariant } from "../types";

export type ModeButtonVariant = "era" | "current";

/** Map era flag or mode variant to button variant. */
export function getModeButtonVariant(
  modeVariant: ModeVariant | boolean | undefined
): ModeButtonVariant {
  if (modeVariant === true || modeVariant === "era") return "era";
  return "current";
}

export type ModeStartButtonSize = "home" | "compact";
