import { SPACING } from "@/lib/ui/design-system";

export type PanelSurface = "programme" | "scoreboard" | "clipboard";
export type PanelVariant = "base" | "elevated" | "inset" | "featured";

const SURFACE_CLASS: Record<PanelSurface, string> = {
  programme: "programme-panel",
  scoreboard: "scoreboard-panel",
  clipboard: "clipboard-panel",
};

export function panelSurfaceClass(
  surface: PanelSurface,
  variant: PanelVariant = "base",
  flush = false
): string {
  const base = SURFACE_CLASS[surface];
  const parts = [base];
  if (variant === "elevated") parts.push(`${base}--elevated`);
  if (variant === "inset") parts.push(`${base}--inset`);
  if (variant === "featured") {
    parts.push(`${base}--elevated`, `${base}--featured`);
  }
  if (flush) parts.push(`${base}--flush`);
  return parts.join(" ");
}

export function panelPaddedClass(padded: boolean): string {
  return padded ? SPACING.cardPadding : "";
}
