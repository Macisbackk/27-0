import type { CSSProperties, ReactNode } from "react";
import {
  panelPaddedClass,
  panelSurfaceClass,
  type PanelVariant,
} from "@/components/ui/panelSurfaces";

interface ScoreboardPanelProps {
  children: ReactNode;
  variant?: PanelVariant;
  flush?: boolean;
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "header";
}

/** Broadcast scoreboard block — top/bottom bars, near-zero radius. */
export function ScoreboardPanel({
  children,
  variant = "base",
  flush = false,
  padded = false,
  className = "",
  style,
  as: Tag = "div",
}: ScoreboardPanelProps) {
  return (
    <Tag
      className={`${panelSurfaceClass("scoreboard", variant, flush)} ${panelPaddedClass(padded)} ${className}`.trim()}
      style={style}
    >
      <div className="panel-body relative z-[1]">{children}</div>
    </Tag>
  );
}
