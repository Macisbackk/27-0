import type { ModeVariant } from "../types";
import { BTN } from "./design-system";

export type ModeButtonVariant = "era" | "current";

/** Map era flag or mode variant to button variant. */
export function getModeButtonVariant(
  modeVariant: ModeVariant | boolean | undefined
): ModeButtonVariant {
  if (modeVariant === true || modeVariant === "era") return "era";
  return "current";
}

export type ModeStartButtonSize = "home" | "compact";

/** Shared class strings for mode start CTAs — includes semantic CSS hooks for compositing fixes. */
export function getModeStartButtonClass(
  variant: ModeButtonVariant,
  size: ModeStartButtonSize = "home",
  hardMode = false
): string {
  if (variant === "era") {
    return size === "home" ? BTN.eraStart : BTN.eraStartCompact;
  }
  if (hardMode) {
    return size === "home" ? BTN.currentStartHard : BTN.currentStartCompactHard;
  }
  return size === "home" ? BTN.currentStart : BTN.currentStartCompact;
}
