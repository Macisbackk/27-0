"use client";

import { useState, type ReactNode } from "react";
import { MOBILE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface CollapsibleDetailsProps {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Priority-3 content: collapsed on mobile by default, expandable. */
export function CollapsibleDetails({
  summary,
  children,
  defaultOpen = false,
  className = "",
}: CollapsibleDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`w-full min-w-0 rounded-lg border border-pitch-700/40 bg-pitch-950/40 ${className}`}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className={`${MOBILE.touchTarget} cursor-pointer list-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-pitch-400 marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="text-pitch-500">
            {open ? "▾" : "▸"}
          </span>
          {summary}
        </span>
      </summary>
      <div className={`border-t border-pitch-700/30 px-3 py-2 ${SPACING.stackSm}`}>
        {children}
      </div>
    </details>
  );
}

interface MobileSectionHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  /** When true, subtitle is hidden below sm (priority 3). */
  collapseSubtitleOnMobile?: boolean;
  className?: string;
}

export function MobileSectionHeader({
  label,
  title,
  subtitle,
  collapseSubtitleOnMobile = true,
  className = "",
}: MobileSectionHeaderProps) {
  return (
    <header className={`w-full min-w-0 text-center ${className}`}>
      {label ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500 sm:text-xs">
          {label}
        </p>
      ) : null}
      <h2 className={`${MOBILE.sectionTitle} mt-0.5 text-white`}>{title}</h2>
      {subtitle ? (
        <p
          className={`mt-1 ${TYPO.bodySm} text-pitch-400 ${
            collapseSubtitleOnMobile ? MOBILE.secondaryCopy : ""
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

interface ResponsiveInfoGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

/** Compact priority-2 stats grid. */
export function ResponsiveInfoGrid({
  children,
  cols = 2,
  className = "",
}: ResponsiveInfoGridProps) {
  const colClass =
    cols === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : cols === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";
  return (
    <div className={`grid ${colClass} gap-2 sm:gap-3 ${MOBILE.minZero} ${className}`}>
      {children}
    </div>
  );
}
