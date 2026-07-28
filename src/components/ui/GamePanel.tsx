import type { CSSProperties, ReactNode } from "react";
import { SPACING } from "@/lib/ui/design-system";

export type GamePanelVariant = "base" | "elevated" | "inset" | "featured";

interface GamePanelProps {
  children: ReactNode;
  variant?: GamePanelVariant;
  /** Hide the left kit stripe (e.g. nested rows). */
  flush?: boolean;
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article";
}

const VARIANT_CLASS: Record<GamePanelVariant, string> = {
  base: "game-panel",
  elevated: "game-panel game-panel--elevated",
  inset: "game-panel game-panel--inset",
  featured: "game-panel game-panel--elevated game-panel--featured",
};

/** Shared 27-0 clubhouse panel — kit stripe + tertiary trim. */
export function GamePanel({
  children,
  variant = "base",
  flush = false,
  padded = false,
  className = "",
  style,
  as: Tag = "div",
}: GamePanelProps) {
  return (
    <Tag
      className={`${VARIANT_CLASS[variant]}${flush ? " game-panel--flush" : ""}${
        padded ? ` ${SPACING.cardPadding}` : ""
      } ${className}`.trim()}
      style={style}
    >
      <div className="game-panel__body relative z-[1]">{children}</div>
    </Tag>
  );
}
