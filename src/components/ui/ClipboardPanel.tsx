import type { CSSProperties, ReactNode } from "react";
import {
  panelPaddedClass,
  panelSurfaceClass,
  type PanelVariant,
} from "@/components/ui/panelSurfaces";

interface ClipboardPanelProps {
  children: ReactNode;
  variant?: PanelVariant;
  flush?: boolean;
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article";
}

/** Coach clipboard / tactics board — pitch grid overlay, pinned corner. */
export function ClipboardPanel({
  children,
  variant = "base",
  flush = false,
  padded = false,
  className = "",
  style,
  as: Tag = "div",
}: ClipboardPanelProps) {
  return (
    <Tag
      className={`${panelSurfaceClass("clipboard", variant, flush)} ${panelPaddedClass(padded)} ${className}`.trim()}
      style={style}
    >
      <div className="panel-body relative z-[1]">{children}</div>
    </Tag>
  );
}
