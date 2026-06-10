"use client";

import type { ReactNode } from "react";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface StatBoxProps {
  label: string;
  value: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Lighter value text (tier labels, secondary stats). */
  light?: boolean;
  /** Tighter padding and text for recruitment cards on mobile. */
  compact?: boolean;
  /** Gold highlight for emphasis. */
  highlight?: boolean;
  className?: string;
}

export function StatBox({
  label,
  value,
  size = "md",
  light = false,
  compact = false,
  highlight = false,
  className = "",
}: StatBoxProps) {
  const isTier = label === "Tier";

  const valueClass = (() => {
    if (highlight) return "font-medium !text-accent-gold";
    if (light && isTier) {
      return `font-normal text-gray-300 ${
        compact
          ? "whitespace-nowrap text-[10px] leading-snug sm:text-sm"
          : "whitespace-nowrap text-[11px] sm:text-sm"
      }`;
    }
    if (light) {
      return compact
        ? "break-words text-[10px] font-normal leading-snug text-gray-300 sm:text-sm"
        : "break-words font-normal text-gray-300";
    }
    if (size === "lg") return TYPO.statValueLg;
    if (size === "sm" || compact) {
      return compact
        ? "text-[10px] font-medium leading-snug text-white sm:text-sm"
        : "text-xs font-medium text-white";
    }
    return TYPO.statValue;
  })();

  const paddingClass = compact
    ? "px-2 py-1.5"
    : size === "lg"
      ? "px-2.5 py-2"
      : "px-2 py-1.5";

  return (
    <div
      className={`${CARD.stat} flex min-h-0 flex-col ${
        isTier ? "min-w-[5.5rem]" : "min-w-0"
      } ${paddingClass} ${className}`}
    >
      <p
        className={`${TYPO.statLabel} shrink-0 ${
          compact ? "text-[9px] tracking-wide sm:text-[10px]" : ""
        }`}
      >
        {label}
      </p>
      <p className={`mt-1 min-w-0 ${valueClass}`}>{value}</p>
    </div>
  );
}

/** Tier stat box spans full row on narrow layouts. */
export const TIER_STAT_SPAN_CLASS = "col-span-2 sm:col-span-1";
