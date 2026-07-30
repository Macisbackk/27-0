import type { CSSProperties, ReactNode } from "react";
import {
  panelPaddedClass,
  panelSurfaceClass,
  type PanelSurface,
  type PanelVariant,
} from "@/components/ui/panelSurfaces";

export type GamePanelVariant = PanelVariant;
export type GamePanelSurface = PanelSurface;

interface GamePanelProps {
  children: ReactNode;
  /** Visual family — programme (default), scoreboard, or clipboard. */
  surface?: PanelSurface;
  variant?: PanelVariant;
  /** Hide surface-specific trim (kit stripe / pin / bars). */
  flush?: boolean;
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "nav";
  label?: string;
  "aria-label"?: string;
}

/**
 * Shared 27-0 panel router.
 * Prefer ProgrammePanel / ScoreboardPanel / ClipboardPanel for new code.
 */
export function GamePanel({
  children,
  surface = "programme",
  variant = "base",
  flush = false,
  padded = false,
  className = "",
  style,
  as: Tag = "div",
  label,
  "aria-label": ariaLabel,
}: GamePanelProps) {
  return (
    <Tag
      className={`${panelSurfaceClass(surface, variant, flush)} ${panelPaddedClass(padded)} ${className}`.trim()}
      style={style}
      aria-label={ariaLabel}
    >
      <div className="panel-body game-panel__body relative z-[1]">
        {label && surface === "programme" ? (
          <p className="programme-panel__label mb-2">{label}</p>
        ) : null}
        {children}
      </div>
    </Tag>
  );
}
