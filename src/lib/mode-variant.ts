import type { ModeVariant } from "./types";

export const DEFAULT_MODE_VARIANT: ModeVariant = "current";

export function normalizeModeVariant(
  value?: string | null | ModeVariant
): ModeVariant {
  return value === "era" ? "era" : "current";
}

export function modeVariantFromEraFlag(eraMode?: boolean): ModeVariant {
  return eraMode ? "era" : "current";
}

/** Resolve Normal Mode variant from run payload or recording options. */
export function resolveClassicModeVariant(input: {
  modeVariant?: ModeVariant;
  normalEraMode?: boolean;
}): ModeVariant {
  if (input.modeVariant) return input.modeVariant;
  if (input.normalEraMode) return "era";
  return DEFAULT_MODE_VARIANT;
}
