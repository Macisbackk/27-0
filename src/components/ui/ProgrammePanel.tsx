import type { CSSProperties, ReactNode } from "react";
import {
  panelPaddedClass,
  panelSurfaceClass,
  type PanelVariant,
} from "@/components/ui/panelSurfaces";

interface ProgrammePanelProps {
  children: ReactNode;
  variant?: PanelVariant;
  flush?: boolean;
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article";
  label?: string;
}

/** Matchday programme / club office panel — sharp corners, paper header rule. */
export function ProgrammePanel({
  children,
  variant = "base",
  flush = false,
  padded = false,
  className = "",
  style,
  as: Tag = "div",
  label,
}: ProgrammePanelProps) {
  return (
    <Tag
      className={`${panelSurfaceClass("programme", variant, flush)} ${panelPaddedClass(padded)} ${className}`.trim()}
      style={style}
    >
      <div className="panel-body relative z-[1]">
        {label ? <p className="programme-panel__label mb-2">{label}</p> : null}
        {children}
      </div>
    </Tag>
  );
}
